-- RemixArtifact 2.0 is the publishable product. Legacy natural-language
-- RemixPrompt drafts remain nullable migration data and are never a release gate.

create or replace function public.guard_remix_artifact_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_width integer;
  v_gate_count integer;
begin
  if tg_op = 'UPDATE' and new.status = 'queued' and old.status is distinct from 'queued' then
    new.remix_artifact := null;
    new.remix_bundle_path := null;
    new.remix_evidence_path := null;
    new.remix_compiler_job_id := null;
    new.remix_prompt := null;
    new.remix_prompt_reviewed_at := null;
    new.remix_prompt_reviewed_by := null;
  end if;

  if new.status = 'published' then
    select count(*) into v_gate_count
    from jsonb_object_keys(case
      when jsonb_typeof(new.remix_artifact #> '{quality,gates}') = 'object'
      then new.remix_artifact #> '{quality,gates}'
      else '{}'::jsonb
    end);

    if new.remix_artifact is null
      or new.remix_artifact ->> 'version' <> '2.0'
      or new.remix_artifact #>> '{reference,siteId}' <> new.id::text
      or new.remix_artifact #>> '{quality,status}' <> 'passed'
      or coalesce((new.remix_artifact #>> '{quality,minimumVisualSimilarity}')::numeric, 0) < 0.9
      or coalesce((new.remix_artifact #>> '{quality,worstVisualSimilarity}')::numeric, 0) < 0.9
      or coalesce((new.remix_artifact #>> '{quality,maskedPixelRatio}')::numeric, 1) > 0.01
      or new.remix_artifact #>> '{compiler,deterministic}' <> 'true'
      or new.remix_artifact #>> '{safety,executableSourceScriptsIncluded}' <> 'false'
      or new.remix_artifact #>> '{safety,credentialFlowsBlocked}' <> 'true'
      or jsonb_typeof(new.remix_artifact #> '{quality,gates}') is distinct from 'object'
      or v_gate_count <> 11
      or jsonb_typeof(new.remix_artifact #> '{quality,viewports}') is distinct from 'array'
      or jsonb_typeof(new.remix_artifact #> '{evidence,sourceScreenshots}') is distinct from 'array'
      or new.remix_bundle_path is null
      or position(new.id::text || '/' in new.remix_bundle_path) <> 1
      or new.remix_bundle_path !~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,511}$'
      or exists (
        select 1 from unnest(string_to_array(new.remix_bundle_path, '/')) as segment
        where segment in ('', '.', '..')
      )
      or new.remix_evidence_path is null
      or position(new.id::text || '/' in new.remix_evidence_path) <> 1
      or new.remix_evidence_path !~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,511}$'
      or exists (
        select 1 from unnest(string_to_array(new.remix_evidence_path, '/')) as segment
        where segment in ('', '.', '..')
      )
      or new.remix_compiler_job_id is null
      or exists (
        select 1
        from jsonb_each_text(case
          when jsonb_typeof(new.remix_artifact #> '{quality,gates}') = 'object'
          then new.remix_artifact #> '{quality,gates}'
          else '{}'::jsonb
        end) as gate(name, passed)
        where passed <> 'true'
      )
    then
      raise exception 'REMIX_ARTIFACT_QUALITY_REQUIRED';
    end if;

    foreach v_width in array array[375, 768, 1280, 1920]
    loop
      if not exists (
        select 1
        from jsonb_array_elements(new.remix_artifact #> '{quality,viewports}') as viewport
        where (viewport ->> 'width')::integer = v_width
          and (viewport ->> 'visualSimilarity')::numeric >= 0.9
      ) or not exists (
        select 1
        from jsonb_array_elements(new.remix_artifact #> '{evidence,sourceScreenshots}') as screenshot
        where (screenshot ->> 'width')::integer = v_width
      ) then
        raise exception 'REMIX_ARTIFACT_QUALITY_REQUIRED';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_guard_remix_artifact_status on public.sites;
create trigger sites_guard_remix_artifact_status
before update of status, remix_artifact, remix_bundle_path, remix_evidence_path, remix_compiler_job_id
on public.sites
for each row execute function public.guard_remix_artifact_status();

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
  v_width integer;
  v_gate_count integer;
begin
  if v_moderator_id is null or not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_action not in ('approve', 'reject') then raise exception 'INVALID_REVIEW_ACTION'; end if;

  select * into v_site from public.sites where id = p_site_id for update;
  if not found then raise exception 'SITE_NOT_FOUND'; end if;
  if v_site.status <> 'in_review' then raise exception 'STALE_REVIEW_STATE'; end if;

  if p_action = 'approve' then
    if p_category_name is null then raise exception 'CATEGORY_REQUIRED'; end if;
    select id into v_category_id from public.categories where name = p_category_name;
    if v_category_id is null then raise exception 'CATEGORY_NOT_FOUND'; end if;

    v_design_spec := coalesce(p_design_spec, v_site.design_spec);
    if v_design_spec is null then raise exception 'DESIGN_SPEC_REQUIRED'; end if;

    select count(*) into v_gate_count
    from jsonb_object_keys(case
      when jsonb_typeof(v_site.remix_artifact #> '{quality,gates}') = 'object'
      then v_site.remix_artifact #> '{quality,gates}'
      else '{}'::jsonb
    end);

    if v_site.remix_artifact is null
      or v_site.remix_artifact ->> 'version' <> '2.0'
      or v_site.remix_artifact #>> '{reference,siteId}' <> v_site.id::text
      or v_site.remix_artifact #>> '{quality,status}' <> 'passed'
      or coalesce((v_site.remix_artifact #>> '{quality,minimumVisualSimilarity}')::numeric, 0) < 0.9
      or coalesce((v_site.remix_artifact #>> '{quality,worstVisualSimilarity}')::numeric, 0) < 0.9
      or coalesce((v_site.remix_artifact #>> '{quality,maskedPixelRatio}')::numeric, 1) > 0.01
      or v_site.remix_artifact #>> '{compiler,deterministic}' <> 'true'
      or v_site.remix_artifact #>> '{safety,executableSourceScriptsIncluded}' <> 'false'
      or v_site.remix_artifact #>> '{safety,credentialFlowsBlocked}' <> 'true'
      or jsonb_typeof(v_site.remix_artifact #> '{quality,gates}') is distinct from 'object'
      or v_gate_count <> 11
      or jsonb_typeof(v_site.remix_artifact #> '{quality,viewports}') is distinct from 'array'
      or jsonb_typeof(v_site.remix_artifact #> '{evidence,sourceScreenshots}') is distinct from 'array'
      or v_site.remix_bundle_path is null
      or position(v_site.id::text || '/' in v_site.remix_bundle_path) <> 1
      or v_site.remix_bundle_path !~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,511}$'
      or exists (
        select 1 from unnest(string_to_array(v_site.remix_bundle_path, '/')) as segment
        where segment in ('', '.', '..')
      )
      or v_site.remix_evidence_path is null
      or position(v_site.id::text || '/' in v_site.remix_evidence_path) <> 1
      or v_site.remix_evidence_path !~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,511}$'
      or exists (
        select 1 from unnest(string_to_array(v_site.remix_evidence_path, '/')) as segment
        where segment in ('', '.', '..')
      )
      or v_site.remix_compiler_job_id is null
      or exists (
        select 1
        from jsonb_each_text(case
          when jsonb_typeof(v_site.remix_artifact #> '{quality,gates}') = 'object'
          then v_site.remix_artifact #> '{quality,gates}'
          else '{}'::jsonb
        end) as gate(name, passed)
        where passed <> 'true'
      )
    then
      raise exception 'REMIX_ARTIFACT_QUALITY_REQUIRED';
    end if;

    foreach v_width in array array[375, 768, 1280, 1920]
    loop
      if not exists (
        select 1
        from jsonb_array_elements(v_site.remix_artifact #> '{quality,viewports}') as viewport
        where (viewport ->> 'width')::integer = v_width
          and (viewport ->> 'visualSimilarity')::numeric >= 0.9
      ) or not exists (
        select 1
        from jsonb_array_elements(v_site.remix_artifact #> '{evidence,sourceScreenshots}') as screenshot
        where (screenshot ->> 'width')::integer = v_width
      ) then
        raise exception 'REMIX_ARTIFACT_QUALITY_REQUIRED';
      end if;
    end loop;

    update public.sites set
      category_id = v_category_id,
      design_spec = v_design_spec,
      design_spec_version = coalesce(v_design_spec ->> 'version', '1.0'),
      remix_prompt = null,
      remix_prompt_reviewed_at = null,
      remix_prompt_reviewed_by = null,
      status = 'published',
      published_at = v_reviewed_at
    where id = p_site_id;
    v_target_status := 'published';
  else
    if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'REJECTION_REASON_REQUIRED'; end if;
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
      'remixArtifactReviewed', true,
      'artifactId', v_site.remix_artifact ->> 'artifactId',
      'worstVisualSimilarity', v_site.remix_artifact #> '{quality,worstVisualSimilarity}'
    ) else null end
  );

  return v_target_status;
end;
$$;

revoke all on function public.review_site(uuid, text, text, jsonb, text, text) from public, anon;
grant execute on function public.review_site(uuid, text, text, jsonb, text, text) to authenticated;

comment on function public.review_site is
  'Atomically moderates a site. Approval requires a complete RemixArtifact 2.0 whose worst required viewport and every quality gate passed; legacy prose prompts are ignored.';
