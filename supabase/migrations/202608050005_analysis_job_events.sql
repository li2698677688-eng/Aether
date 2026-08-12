create table public.analysis_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.analysis_jobs(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  previous_status public.site_status,
  status public.site_status not null,
  attempts integer not null check (attempts between 0 and 3),
  stage_duration_ms bigint check (stage_duration_ms is null or stage_duration_ms >= 0),
  total_duration_ms integer check (total_duration_ms is null or total_duration_ms >= 0),
  error_code text,
  created_at timestamptz not null default now()
);

create index analysis_job_events_job_idx on public.analysis_job_events (job_id, created_at desc);
create index analysis_job_events_site_idx on public.analysis_job_events (site_id, created_at desc);

alter table public.analysis_job_events enable row level security;

create policy "users read events for own sites" on public.analysis_job_events for select using (
  exists(
    select 1 from public.sites
    where sites.id = analysis_job_events.site_id
      and (sites.submitted_by = auth.uid() or public.is_admin())
  )
);

revoke all on public.analysis_job_events from anon, authenticated;
grant select on public.analysis_job_events to authenticated;

insert into public.analysis_job_events (
  job_id, site_id, previous_status, status, attempts, stage_duration_ms, total_duration_ms, error_code, created_at
)
select id, site_id, null, status, attempts, null, duration_ms, error_code, created_at
from public.analysis_jobs;

create or replace function public.log_analysis_job_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage_duration_ms bigint;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status
      and new.attempts is not distinct from old.attempts
      and new.error_code is not distinct from old.error_code
      and new.duration_ms is not distinct from old.duration_ms then
      return new;
    end if;

    v_stage_duration_ms := greatest(
      0,
      floor(extract(epoch from (clock_timestamp() - coalesce(old.stage_started_at, old.updated_at, old.created_at))) * 1000)::bigint
    );
  end if;

  insert into public.analysis_job_events (
    job_id,
    site_id,
    previous_status,
    status,
    attempts,
    stage_duration_ms,
    total_duration_ms,
    error_code
  ) values (
    new.id,
    new.site_id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    new.attempts,
    v_stage_duration_ms,
    new.duration_ms,
    new.error_code
  );

  return new;
end;
$$;

revoke all on function public.log_analysis_job_event() from public, anon, authenticated;

create trigger jobs_log_stage_insert
after insert on public.analysis_jobs
for each row execute function public.log_analysis_job_event();

create trigger jobs_log_stage_update
after update of status, attempts, error_code, duration_ms on public.analysis_jobs
for each row execute function public.log_analysis_job_event();

comment on table public.analysis_job_events is 'Immutable stage history for analysis timing, retries and failures.';
