create or replace function public.review_site(
  p_site_id uuid,
  p_action text,
  p_category_name text default null,
  p_design_spec jsonb default null,
  p_remix_prompt text default null,
  p_reason text default null
)
returns public.site_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moderator_id uuid := auth.uid();
  v_site public.sites%rowtype;
  v_category_id bigint;
  v_design_spec jsonb;
  v_reviewed_at timestamptz := now();
  v_job_count integer;
  v_target_status public.site_status;
begin
  if v_moderator_id is null or not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_action not in ('approve', 'reject') then
    raise exception 'INVALID_REVIEW_ACTION';
  end if;

  select * into v_site
  from public.sites
  where id = p_site_id
  for update;

  if not found then raise exception 'SITE_NOT_FOUND'; end if;
  if v_site.status <> 'in_review' then raise exception 'STALE_REVIEW_STATE'; end if;

  if p_action = 'approve' then
    if p_category_name is null then raise exception 'CATEGORY_REQUIRED'; end if;
    select id into v_category_id from public.categories where name = p_category_name;
    if v_category_id is null then raise exception 'CATEGORY_NOT_FOUND'; end if;

    v_design_spec := coalesce(p_design_spec, v_site.design_spec);
    if v_design_spec is null then raise exception 'DESIGN_SPEC_REQUIRED'; end if;
    if p_remix_prompt is null or length(p_remix_prompt) > 48000 then
      raise exception 'REMIX_PROMPT_REQUIRED';
    end if;

    update public.sites set
      category_id = v_category_id,
      design_spec = v_design_spec,
      design_spec_version = coalesce(v_design_spec ->> 'version', '1.0'),
      remix_prompt = p_remix_prompt,
      remix_prompt_reviewed_at = v_reviewed_at,
      remix_prompt_reviewed_by = v_moderator_id,
      status = 'published',
      published_at = v_reviewed_at
    where id = p_site_id;
    v_target_status := 'published';
  else
    if p_reason is null or length(btrim(p_reason)) < 3 then
      raise exception 'REJECTION_REASON_REQUIRED';
    end if;
    update public.sites set status = 'rejected' where id = p_site_id;
    v_target_status := 'rejected';
  end if;

  update public.analysis_jobs
  set status = v_target_status
  where site_id = p_site_id and status = 'in_review';
  get diagnostics v_job_count = row_count;
  if v_job_count = 0 then raise exception 'ANALYSIS_JOB_NOT_IN_REVIEW'; end if;

  insert into public.moderation_logs (site_id, moderator_id, action, reason, changes)
  values (
    p_site_id,
    v_moderator_id,
    p_action,
    case when p_action = 'reject' then btrim(p_reason) else null end,
    case when p_action = 'approve' then jsonb_build_object(
      'category', p_category_name,
      'designSpecEdited', p_design_spec is not null,
      'remixPromptReviewed', true
    ) else null end
  );

  return v_target_status;
end;
$$;

revoke all on function public.review_site(uuid, text, text, jsonb, text, text) from public, anon;
grant execute on function public.review_site(uuid, text, text, jsonb, text, text) to authenticated;

comment on function public.review_site is 'Atomically approves or rejects a reviewed site, updates its analysis job, and appends the moderation log.';

create or replace function public.retry_site_analysis(p_site_id uuid)
returns table(job_id uuid, url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moderator_id uuid := auth.uid();
  v_site public.sites%rowtype;
  v_job public.analysis_jobs%rowtype;
begin
  if v_moderator_id is null or not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into v_site from public.sites where id = p_site_id for update;
  if not found then raise exception 'SITE_NOT_FOUND'; end if;
  if v_site.status not in ('in_review', 'rejected', 'failed') then raise exception 'STALE_REVIEW_STATE'; end if;

  select * into v_job
  from public.analysis_jobs
  where site_id = p_site_id
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'ANALYSIS_JOB_NOT_FOUND'; end if;
  if v_job.status not in ('in_review', 'rejected', 'failed') then raise exception 'STALE_JOB_STATE'; end if;

  update public.sites set status = 'queued' where id = p_site_id;
  update public.analysis_jobs set
    status = 'queued',
    attempts = 0,
    error_code = null,
    error_message = null,
    run_after = now(),
    stage_started_at = now()
  where id = v_job.id;

  insert into public.moderation_logs (site_id, moderator_id, action, changes)
  values (p_site_id, v_moderator_id, 'retry', jsonb_build_object('jobId', v_job.id));

  return query select v_job.id, v_site.url;
end;
$$;

create or replace function public.fail_analysis_retry(
  p_site_id uuid,
  p_job_id uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moderator_id uuid := auth.uid();
  v_site_status public.site_status;
  v_job public.analysis_jobs%rowtype;
begin
  if v_moderator_id is null or not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select status into v_site_status from public.sites where id = p_site_id for update;
  if not found then raise exception 'SITE_NOT_FOUND'; end if;
  if v_site_status <> 'queued' then raise exception 'STALE_REVIEW_STATE'; end if;
  select * into v_job
  from public.analysis_jobs
  where id = p_job_id and site_id = p_site_id
  for update;
  if not found then raise exception 'ANALYSIS_JOB_NOT_FOUND'; end if;
  if v_job.status <> 'queued' then raise exception 'STALE_JOB_STATE'; end if;

  update public.sites set status = 'failed' where id = p_site_id;
  update public.analysis_jobs set status = 'failed', error_code = p_error_code where id = p_job_id;
end;
$$;

revoke all on function public.retry_site_analysis(uuid) from public, anon;
revoke all on function public.fail_analysis_retry(uuid, uuid, text) from public, anon;
grant execute on function public.retry_site_analysis(uuid) to authenticated;
grant execute on function public.fail_analysis_retry(uuid, uuid, text) to authenticated;

comment on function public.retry_site_analysis is 'Atomically resets a reviewable analysis job and records the administrator retry.';
comment on function public.fail_analysis_retry is 'Atomically marks both records failed when a prepared retry cannot be enqueued.';
