alter table public.sites
  add column if not exists remix_prompt text,
  add column if not exists remix_prompt_reviewed_at timestamptz,
  add column if not exists remix_prompt_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.sites
  add constraint sites_remix_prompt_size check (remix_prompt is null or length(remix_prompt) <= 48000);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute procedure public.touch_updated_at();
create trigger sites_touch_updated_at before update on public.sites
for each row execute procedure public.touch_updated_at();
create trigger jobs_touch_updated_at before update on public.analysis_jobs
for each row execute procedure public.touch_updated_at();

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

revoke all on function public.submit_site(text, text, text, text) from public;
grant execute on function public.submit_site(text, text, text, text) to authenticated;

create index if not exists sites_review_queue_idx on public.sites (updated_at, id) where status = 'in_review';

comment on column public.sites.remix_prompt is 'Administrator-reviewed Remix Prompt 1.0 draft exposed only through trusted application flows.';
