-- =====================================================================
-- MiniATS · Fix FK violation when logging an organization's own deletion
--
-- log_organization_activity()'s DELETE branch logged the entry scoped to
-- the organization being deleted (organization_id = old.id). Unlike a
-- job or candidate — which log against their *owning* organization,
-- which still exists after they're deleted — an organization logging
-- its own deletion references itself, and by the time this AFTER DELETE
-- trigger runs, that row is already gone from the table:
--
--   insert or update on table "activity_logs" violates foreign key
--   constraint "activity_logs_organization_id_fkey"
--
-- Fix: scope the "deleted_permanently" entry to no organization (null)
-- instead — there's no one left to see it as "their" organization's
-- history anyway (deleting an org requires it to have no users left),
-- so an admin-only entry is the correct outcome, not just a workaround.
-- Creation and renames are unaffected: the organization still exists at
-- that point, so the self-reference is valid and its own customers can
-- still see those entries, same as before.
-- =====================================================================

create or replace function public.log_organization_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.id, 'organization', new.id, new.name, 'created');
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.log_activity(null, 'organization', old.id, old.name, 'deleted_permanently');
    return null;
  end if;

  -- UPDATE (only "name" today, but future columns fall in here for free)
  v_changes := public.changed_fields(to_jsonb(old), to_jsonb(new), array['name']);
  if v_changes = '{}'::jsonb then
    return null; -- nothing worth logging (e.g. only updated_at)
  end if;

  perform public.log_activity(new.id, 'organization', new.id, new.name, 'updated',
    jsonb_build_object('changes', v_changes));
  return null;
end;
$$;
