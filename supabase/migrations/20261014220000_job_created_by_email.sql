-- =====================================================================
-- MiniATS · "Created by" shows the creator's email
--
-- Replaces the stored display name (20261014210000) with the email,
-- which is unique and always present.
-- =====================================================================

alter table public.jobs
  rename column created_by_name to created_by_email;

-- Backfill with emails. The trigger freezes this column on UPDATE, so
-- switch it off for this one statement.
alter table public.jobs disable trigger jobs_set_creator;

update public.jobs j
set created_by_email = p.email
from public.profiles p
where p.id = j.created_by;

alter table public.jobs enable trigger jobs_set_creator;

create or replace function public.set_job_creator()
returns trigger
language plpgsql
security definer  -- read the creator's profile regardless of RLS
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_by_email := old.created_by_email;
    return new;
  end if;

  -- Signed-in user wins over anything the client sent. Without a session
  -- (SQL editor, service role) keep the given value.
  new.created_by := coalesce((select auth.uid()), new.created_by);

  select p.email
    into new.created_by_email
  from public.profiles p
  where p.id = new.created_by;

  return new;
end;
$$;
