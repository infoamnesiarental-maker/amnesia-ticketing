-- Bucket público para tapas de eventos (URLs en landing / ticketera).
-- Subida solo desde el servidor con SUPABASE_SERVICE_ROLE_KEY (ver uploadEventCoverImage en web).
-- Ejecutar en Supabase SQL Editor después de schema.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event_covers',
  'event_covers',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
