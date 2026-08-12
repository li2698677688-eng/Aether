insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-screenshots-private', 'site-screenshots-private', false, 15728640, array['image/avif', 'image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets set public = false where id = 'site-screenshots';
drop policy if exists "published screenshots are public" on storage.objects;

comment on table storage.buckets is 'DesignFeed screenshots remain private; published files are streamed through a status-aware CDN endpoint.';
