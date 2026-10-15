-- =====================================================================
-- MiniATS · Candidates → activity log (basic tier)
--
-- Candidates now hook into the same activity_logs table as jobs:
--   • created  — a candidate is added (to the talent pool or a job)
--   • deleted_permanently — a candidate is deleted (candidates have no
--     soft delete, so every delete is permanent)
-- Field-level edits (name/contact/notes changes) and pipeline stage
-- moves are intentionally out of scope here — see issue #27.
-- =====================================================================

alter type public.log_entity_type add value 'candidate';

create or replace function public.log_candidate_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'candidate', new.id, new.full_name, 'created');
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.log_activity(old.organization_id, 'candidate', old.id, old.full_name, 'deleted_permanently');
    return null;
  end if;

  return null; -- no other candidate changes are logged yet (see #27)
end;
$$;

revoke execute on function public.log_candidate_activity() from public, anon, authenticated;

create trigger candidates_log_activity
  after insert or delete on public.candidates
  for each row execute function public.log_candidate_activity();

-- ---------------------------------------------------------------------
-- Backfill: a "created" entry for every candidate that already exists.
-- ---------------------------------------------------------------------
insert into public.activity_logs
  (organization_id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, details, created_at)
select c.organization_id, c.created_by, p.email, p.role, 'created', 'candidate', c.id, c.full_name,
       '{}'::jsonb, c.created_at
from public.candidates c
left join public.profiles p on p.id = c.created_by;
