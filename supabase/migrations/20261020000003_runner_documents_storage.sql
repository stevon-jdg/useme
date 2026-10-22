-- Phase 4, migration 3: private storage for runner documents.
--
-- Files live under <user id>/<file name>. A user can upload to and read from their own folder
-- only. Administrators can read everything. There is no update or delete from the browser.
--
-- Known limit: reading a file as an admin is not written to audit_logs yet, because storage
-- reads do not run our functions. Phase 8 adds an Edge Function that issues signed URLs and
-- logs each access.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'runner-documents', 'runner-documents', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy runner_documents_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'runner-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy runner_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'runner-documents'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );
