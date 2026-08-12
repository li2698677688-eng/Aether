create or replace function public.submit_site(
  p_url text,
  p_normalized_url text,
  p_title text,
  p_slug text
)
returns table(site_id uuid, job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_job_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  if exists(select 1 from public.sites where normalized_url = p_normalized_url) then
    raise exception 'DUPLICATE_SITE';
  end if;
  if (select count(*) from public.sites where submitted_by = v_user_id and created_at >= date_trunc('day', now())) >= 3 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;
  if (select count(*) from public.sites where submitted_by = v_user_id and status in ('queued','capturing','analyzing','in_review')) >= 5 then
    raise exception 'PENDING_LIMIT_REACHED';
  end if;

  insert into public.sites (url, normalized_url, title, slug, submitted_by, status)
  values (p_url, p_normalized_url, p_title, p_slug, v_user_id, 'queued')
  returning id into v_site_id;
  insert into public.analysis_jobs (site_id, status)
  values (v_site_id, 'queued') returning id into v_job_id;
  return query select v_site_id, v_job_id;
end;
$$;

create or replace function public.fail_submission_enqueue(
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
  v_user_id uuid := auth.uid();
  v_site public.sites%rowtype;
  v_job public.analysis_jobs%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_error_code is null or length(p_error_code) > 120 then raise exception 'INVALID_ERROR_CODE'; end if;

  select * into v_site from public.sites where id = p_site_id for update;
  if not found then raise exception 'SITE_NOT_FOUND'; end if;
  if v_site.submitted_by <> v_user_id then raise exception 'FORBIDDEN'; end if;
  if v_site.status <> 'queued' then raise exception 'STALE_SUBMISSION_STATE'; end if;

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

revoke all on function public.submit_site(text, text, text, text) from public, anon;
revoke all on function public.fail_submission_enqueue(uuid, uuid, text) from public, anon;
grant execute on function public.submit_site(text, text, text, text) to authenticated;
grant execute on function public.fail_submission_enqueue(uuid, uuid, text) to authenticated;

comment on function public.submit_site is 'Serializes each user submission transaction before applying duplicate and quota checks.';
comment on function public.fail_submission_enqueue is 'Atomically marks a newly submitted site and its job failed when queue handoff cannot complete.';
