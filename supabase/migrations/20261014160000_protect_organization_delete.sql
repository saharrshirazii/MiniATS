-- =====================================================================
-- MiniATS · Only empty organizations can be deleted
--
-- jobs and candidates reference organizations with ON DELETE CASCADE, so
-- deleting an organization would silently wipe its whole pipeline.
-- This trigger refuses the delete while the organization still has users,
-- jobs or candidates — for every caller, not just the web app.
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
  select count(*) into user_count      from public.profiles   where organization_id = old.id;
  select count(*) into job_count       from public.jobs       where organization_id = old.id;
  select count(*) into candidate_count from public.candidates where organization_id = old.id;

  if user_count + job_count + candidate_count > 0 then
    raise exception
      '"%" still has % user(s), % job(s) and % candidate(s). Remove them before deleting the organization.',
      old.name, user_count, job_count, candidate_count
      using errcode = 'restrict_violation';  -- SQLSTATE 23001
  end if;

  return old;
end;
$$;

revoke execute on function public.prevent_delete_nonempty_organization()
  from public, anon, authenticated;

create trigger organizations_prevent_delete_nonempty
  before delete on public.organizations
  for each row execute function public.prevent_delete_nonempty_organization();
