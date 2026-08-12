create extension if not exists pg_trgm;

create type public.profile_role as enum ('user', 'admin');
create type public.site_status as enum ('queued', 'capturing', 'analyzing', 'in_review', 'published', 'rejected', 'failed');
create type public.embed_status as enum ('unknown', 'embeddable', 'screenshot_only');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username is null or username ~ '^[a-z0-9_]{3,30}$'),
  display_name text,
  avatar_url text,
  role public.profile_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null unique,
  position integer not null default 0
);

insert into public.categories (slug, name, position) values
  ('personal-brand', '个人/品牌', 1), ('saas', 'SaaS', 2), ('portfolio', '作品集', 3),
  ('landing-page', '落地页', 4), ('ai-conversation', 'AI/对话', 5), ('mobile-product', '移动产品', 6),
  ('dashboard', '数据面板', 7), ('commerce', '电商', 8), ('experimental', '实验性网页', 9);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  normalized_url text not null unique,
  title text not null,
  slug text not null unique,
  summary text,
  category_id bigint references public.categories(id),
  submitted_by uuid references public.profiles(id) on delete set null,
  status public.site_status not null default 'queued',
  embed_status public.embed_status not null default 'unknown',
  screenshot_desktop text,
  screenshot_desktop_full text,
  screenshot_mobile text,
  screenshot_mobile_full text,
  extraction jsonb,
  design_spec jsonb,
  design_spec_version text,
  featured boolean not null default false,
  captured_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null unique
);

create table public.site_tags (
  site_id uuid not null references public.sites(id) on delete cascade,
  tag_id bigint not null references public.tags(id) on delete cascade,
  primary key (site_id, tag_id)
);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, site_id)
);

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  status public.site_status not null default 'queued',
  attempts integer not null default 0 check (attempts between 0 and 3),
  stage_started_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  error_message text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moderation_logs (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  moderator_id uuid not null references public.profiles(id),
  action text not null check (action in ('approve', 'reject', 'retry', 'edit')),
  reason text,
  changes jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  signature text primary key,
  received_at timestamptz not null default now()
);

create index sites_public_feed_idx on public.sites (featured desc, published_at desc, id) where status = 'published';
create index sites_category_idx on public.sites (category_id, published_at desc) where status = 'published';
create index sites_submitter_idx on public.sites (submitted_by, created_at desc);
create index sites_title_trgm_idx on public.sites using gin (title gin_trgm_ops);
create index sites_slug_idx on public.sites (slug);
create index jobs_due_idx on public.analysis_jobs (status, run_after) where status in ('queued', 'failed');
create index jobs_site_idx on public.analysis_jobs (site_id, created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.sites enable row level security;
alter table public.tags enable row level security;
alter table public.site_tags enable row level security;
alter table public.favorites enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.webhook_events enable row level security;

create policy "public profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Authenticated clients may edit public profile fields, but can never promote their own role.
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, updated_at) on public.profiles to authenticated;
create policy "categories are public" on public.categories for select using (true);
create policy "tags are public" on public.tags for select using (true);
create policy "site tags are public" on public.site_tags for select using (true);

create policy "published sites are public" on public.sites for select using (status = 'published' or submitted_by = auth.uid() or public.is_admin());
create policy "users submit own sites" on public.sites for insert with check (submitted_by = auth.uid() and status = 'queued');
create policy "admins manage sites" on public.sites for all using (public.is_admin()) with check (public.is_admin());

create policy "users read own favorites" on public.favorites for select using (user_id = auth.uid());
create policy "users create own favorites" on public.favorites for insert with check (user_id = auth.uid());
create policy "users delete own favorites" on public.favorites for delete using (user_id = auth.uid());

create policy "users read jobs for own sites" on public.analysis_jobs for select using (
  exists(select 1 from public.sites where sites.id = analysis_jobs.site_id and (sites.submitted_by = auth.uid() or public.is_admin()))
);
create policy "users create jobs for own sites" on public.analysis_jobs for insert with check (
  exists(select 1 from public.sites where sites.id = analysis_jobs.site_id and sites.submitted_by = auth.uid())
);
create policy "admins manage jobs" on public.analysis_jobs for all using (public.is_admin()) with check (public.is_admin());
create policy "admins read moderation logs" on public.moderation_logs for select using (public.is_admin());
create policy "admins write moderation logs" on public.moderation_logs for insert with check (public.is_admin() and moderator_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-screenshots', 'site-screenshots', true, 15728640, array['image/avif', 'image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "published screenshots are public" on storage.objects for select using (bucket_id = 'site-screenshots');

comment on table public.webhook_events is 'Service-role only replay ledger for signed analysis callbacks.';
