-- Supabase projects created with auto_expose_new_tables disabled do not grant
-- Data API privileges automatically. Keep table privileges narrower than RLS.
grant usage on schema public to anon, authenticated, service_role;

revoke all on public.profiles from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.sites from anon, authenticated;
revoke all on public.tags from anon, authenticated;
revoke all on public.site_tags from anon, authenticated;
revoke all on public.favorites from anon, authenticated;
revoke all on public.analysis_jobs from anon, authenticated;
revoke all on public.analysis_job_events from anon, authenticated;
revoke all on public.moderation_logs from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;

grant select (id, username, display_name, avatar_url) on public.profiles to anon;
grant select on public.categories, public.tags, public.site_tags to anon;
grant select (
  id,
  slug,
  title,
  summary,
  url,
  featured,
  created_at,
  published_at,
  captured_at,
  screenshot_desktop,
  screenshot_mobile,
  embed_status,
  status,
  design_spec,
  remix_prompt,
  category_id,
  submitted_by
) on public.sites to anon;

grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, updated_at) on public.profiles to authenticated;
grant select on public.categories, public.tags, public.site_tags to authenticated;
grant select on public.sites to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
grant select on public.analysis_jobs, public.analysis_job_events, public.moderation_logs to authenticated;

drop policy if exists "users update own favorites" on public.favorites;
create policy "users update own favorites" on public.favorites
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

comment on policy "users update own favorites" on public.favorites is
  'Allows an authenticated user to idempotently upsert only their own private favorite row.';
