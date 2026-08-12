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

comment on function public.apply_analysis_callback is 'Atomically claims a signed callback and updates its analysis job and site.';
