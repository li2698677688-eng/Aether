alter table public.sites
  add column if not exists remix_artifact jsonb,
  add column if not exists remix_bundle_path text,
  add column if not exists remix_evidence_path text,
  add column if not exists remix_compiler_job_id text;

alter table public.sites drop constraint if exists sites_remix_artifact_v2;
alter table public.sites add constraint sites_remix_artifact_v2 check (
  remix_artifact is null or (
    remix_artifact ->> 'version' = '2.0'
    and jsonb_typeof(remix_artifact -> 'quality') = 'object'
    and jsonb_typeof(remix_artifact -> 'delivery') = 'object'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'remix_artifacts_private',
  'remix_artifacts_private',
  false,
  524288000,
  array['application/gzip', 'application/json', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.guard_remix_artifact_status()
returns trigger
language plpgsql
set search_path = ''
as $$
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
    if new.remix_artifact is null
      or new.remix_artifact #>> '{quality,status}' <> 'passed'
      or coalesce((new.remix_artifact #>> '{quality,worstVisualSimilarity}')::numeric, 0) < 0.9
      or new.remix_bundle_path is null
      or new.remix_evidence_path is null
    then
      raise exception 'REMIX_ARTIFACT_QUALITY_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_guard_remix_artifact_status on public.sites;
create trigger sites_guard_remix_artifact_status
before update of status on public.sites
for each row execute function public.guard_remix_artifact_status();

drop trigger if exists sites_guard_inserted_remix_artifact on public.sites;
create trigger sites_guard_inserted_remix_artifact
before insert on public.sites
for each row execute function public.guard_remix_artifact_status();

create or replace function public.apply_analysis_callback(
  p_signature text,
  p_job_id uuid,
  p_status public.site_status,
  p_attempts integer default null,
  p_error_code text default null,
  p_duration_ms integer default null,
  p_patch jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.analysis_jobs%rowtype;
begin
  if exists(select 1 from public.webhook_events where signature = p_signature) then
    return 'duplicate';
  end if;

  select * into v_job from public.analysis_jobs where id = p_job_id for update;
  if not found then return 'not_found'; end if;

  if v_job.status <> p_status and not (
    (v_job.status = 'queued' and p_status in ('capturing', 'failed')) or
    (v_job.status = 'capturing' and p_status in ('analyzing', 'failed')) or
    (v_job.status = 'analyzing' and p_status in ('in_review', 'failed')) or
    (v_job.status = 'in_review' and p_status in ('published', 'rejected', 'queued', 'analyzing', 'failed')) or
    (v_job.status = 'rejected' and p_status in ('queued', 'analyzing')) or
    (v_job.status = 'failed' and p_status in ('queued', 'capturing'))
  ) then
    return 'invalid_transition';
  end if;

  update public.analysis_jobs set
    status = p_status,
    attempts = coalesce(p_attempts, attempts),
    error_code = case when p_status = 'failed' then p_error_code else null end,
    duration_ms = coalesce(p_duration_ms, duration_ms),
    stage_started_at = now()
  where id = p_job_id;

  update public.sites set
    status = p_status,
    title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
    summary = case when p_patch ? 'summary' then p_patch ->> 'summary' else summary end,
    url = case when p_patch ? 'finalUrl' then p_patch ->> 'finalUrl' else url end,
    embed_status = case when p_patch ? 'embedStatus' then (p_patch ->> 'embedStatus')::public.embed_status else embed_status end,
    screenshot_desktop = case when p_patch ? 'screenshotDesktop' then p_patch ->> 'screenshotDesktop' else screenshot_desktop end,
    screenshot_desktop_full = case when p_patch ? 'screenshotDesktopFull' then p_patch ->> 'screenshotDesktopFull' else screenshot_desktop_full end,
    screenshot_mobile = case when p_patch ? 'screenshotMobile' then p_patch ->> 'screenshotMobile' else screenshot_mobile end,
    screenshot_mobile_full = case when p_patch ? 'screenshotMobileFull' then p_patch ->> 'screenshotMobileFull' else screenshot_mobile_full end,
    extraction = case when p_patch ? 'extraction' then p_patch -> 'extraction' else extraction end,
    design_spec = case when p_patch ? 'designSpec' then p_patch -> 'designSpec' else design_spec end,
    design_spec_version = case when p_patch ? 'designSpec' then p_patch -> 'designSpec' ->> 'version' else design_spec_version end,
    remix_artifact = case when p_patch ? 'remixArtifact' then p_patch -> 'remixArtifact' else remix_artifact end,
    remix_bundle_path = case when p_patch ? 'remixBundlePath' then p_patch ->> 'remixBundlePath' else remix_bundle_path end,
    remix_evidence_path = case when p_patch ? 'remixEvidencePath' then p_patch ->> 'remixEvidencePath' else remix_evidence_path end,
    remix_compiler_job_id = case when p_patch ? 'remixCompilerJobId' then p_patch ->> 'remixCompilerJobId' else remix_compiler_job_id end,
    captured_at = case when p_status = 'in_review' then now() else captured_at end
  where id = v_job.site_id;

  insert into public.webhook_events (signature) values (p_signature);
  return 'applied';
exception
  when unique_violation then return 'duplicate';
end;
$$;

revoke all on function public.apply_analysis_callback(text, uuid, public.site_status, integer, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.apply_analysis_callback(text, uuid, public.site_status, integer, text, integer, jsonb) to service_role;

grant select (remix_artifact) on public.sites to anon;

comment on column public.sites.remix_artifact is
  'Reviewed RemixArtifact 2.0 manifest. A published row must pass every gate and the worst required viewport must be at least 90% visually similar.';
comment on column public.sites.remix_bundle_path is
  'Private Storage object path for the deterministic generated application bundle.';
comment on column public.sites.remix_evidence_path is
  'Private Storage object path for the browser evidence / render IR used to produce the artifact.';
