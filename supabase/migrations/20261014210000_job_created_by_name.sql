-- =====================================================================
-- MiniATS · "Created by" on jobs
--
-- Stores the creator's display name on the job. A snapshot instead of a
-- join because:
--   • customers may only read their own profile (RLS), so they could not
--     see the name of a colleague or an admin who created the job;
--   • the name stays readable even if that user is deleted later.
-- The trigger sets both columns from the signed-in user; clients cannot
-- spoof them on insert or change them on update.
-- =====================================================================

alter table public.jobs
  add column created_by_name text;

-- Backfill existing jobs. Must run before the trigger exists, because the
-- trigger keeps created_by_name unchanged on UPDATE.
update public.jobs j
set created_by_name = coalesce(nullif(trim(p.full_name), ''), p.email)
from public.profiles p
where p.id = j.created_by
  and j.created_by_name is null;

create or replace function public.set_job_creator()
returns trigger
language plpgsql
security definer  -- read the creator's profile regardless of RLS
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    return new;
  end if;

  -- Signed-in user wins over anything the client sent. Without a session
  -- (SQL editor, service role) keep the given value.
  new.created_by := coalesce((select auth.uid()), new.created_by);

  select coalesce(nullif(trim(p.full_name), ''), p.email)
    into new.created_by_name
  from public.profiles p
  where p.id = new.created_by;

  return new;
end;
$$;

revoke execute on function public.set_job_creator() from public, anon, authenticated;

create trigger jobs_set_creator
  before insert or update on public.jobs
  for each row execute function public.set_job_creator();
