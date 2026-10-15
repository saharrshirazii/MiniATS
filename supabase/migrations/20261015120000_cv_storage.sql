-- =====================================================================
-- MiniATS · CV storage (#16)
--
-- A private bucket for candidate CVs, one PDF per candidate at
-- "<organization_id>/<candidate_id>.pdf". Access mirrors the
-- candidates table's RLS: own organization, or admin.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 10485760, array['application/pdf']) -- 10 MiB
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase; add policies for
-- this bucket only (other buckets, if any, are unaffected).

create policy "cvs: read own organization or admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.my_org())::text
    )
  );

create policy "cvs: upload to own organization or admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.my_org())::text
    )
  );

create policy "cvs: replace own organization or admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.my_org())::text
    )
  )
  with check (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.my_org())::text
    )
  );

create policy "cvs: delete own organization or admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'cvs'
    and (
      (select public.is_admin())
      or (storage.foldername(name))[1] = (select public.my_org())::text
    )
  );
