-- =====================================================================
-- MiniATS · "Created by" on candidates
--
-- Mirrors jobs' created_by_email (20261014210000 / 20261014220000):
-- a snapshot of the creator's email, not a join, because customers can
-- only read their own profile (RLS) and the name should stay readable
-- even if that user is deleted later. The trigger always derives it
-- from the signed-in user, so clients cannot spoof it on insert or
-- change it on update.
-- =====================================================================

alter table public.candidates
  add column created_by_email text;

-- Backfill existing candidates.
update public.candidates c
set created_by_email = p.email
from public.profiles p
where p.id = c.created_by
  and c.created_by_email is null;

create or replace function public.set_candidate_creator()
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

revoke execute on function public.set_candidate_creator() from public, anon, authenticated;

create trigger candidates_set_creator
  before insert or update on public.candidates
  for each row execute function public.set_candidate_creator();
