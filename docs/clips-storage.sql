-- Athletic Lab exercise clips: a private storage bucket. Objects live under <family_id>/<exercise>/<clip>.<ext>
-- and the policies only let a request see, add or remove objects whose first path segment is the hash of
-- the family code it carries in x-family-key (the same family_key_id() the records table uses).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips', 'clips', false, 62914560, array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
on conflict (id) do nothing;

drop policy if exists "family clips read" on storage.objects;
create policy "family clips read" on storage.objects for select to anon
  using (bucket_id = 'clips' and split_part(name, '/', 1) = public.family_key_id());

drop policy if exists "family clips write" on storage.objects;
create policy "family clips write" on storage.objects for insert to anon
  with check (bucket_id = 'clips' and split_part(name, '/', 1) = public.family_key_id());

drop policy if exists "family clips delete" on storage.objects;
create policy "family clips delete" on storage.objects for delete to anon
  using (bucket_id = 'clips' and split_part(name, '/', 1) = public.family_key_id());
