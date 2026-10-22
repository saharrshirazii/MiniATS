-- =====================================================================
-- MiniATS · Organization deletion should ignore soft-deleted jobs
--
-- prevent_delete_nonempty_organization() counted every row in jobs,
-- including ones already soft-deleted (deleted_at is not null). Since a
-- soft-deleted job is meant to be gone from active use (only restorable
-- by an admin for 90 days), it shouldn't block deleting its organization
-- — and if the admin does delete the org, the ON DELETE CASCADE on
-- jobs.organization_id removes it too, which is fine: there's no
-- organization left for a restore to belong to.
-- =====================================================================

create or replace function public.prevent_delete_nonempty_organization()
returns trigger
language plpgsql
security definer  -- count rows the caller may not be able to see through RLS
set search_path = ''
as $$
declare
  user_count       integer;
  job_count        integer;
  candidate_count  integer;
begin
  select count(*) into user_count
    from public.profiles where organization_id = old.id;
  select count(*) into job_count
    from public.jobs where organization_id = old.id and deleted_at is null;
  select count(*) into candidate_count
    from public.candidates where organization_id = old.id;

  if user_count + job_count + candidate_count > 0 then
    raise exception
      '"%" still has % user(s), % job(s) and % candidate(s). Remove them before deleting the organization.',
      old.name, user_count, job_count, candidate_count
      using errcode = 'restrict_violation';  -- SQLSTATE 23001
  end if;

  return old;
end;
$$;
