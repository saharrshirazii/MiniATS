-- =====================================================================
-- MiniATS · log_activity: tolerate a dangling organization_id
--
-- 20261022193000 fixed this for an organization's OWN "deleted" entry,
-- but missed the general case: deleting an organization also cascades
-- to any jobs/candidates still attached to it — including a soft-deleted
-- job, which isn't removed by a normal delete and so is still there to
-- cascade. That job's own "deleted_permanently" log entry references
-- its organization_id (the org now being deleted), and by the time its
-- AFTER DELETE trigger runs, the parent organizations row is already
-- gone from the same transaction:
--
--   insert or update on table "activity_logs" violates foreign key
--   constraint "activity_logs_organization_id_fkey"
--
-- Rather than special-case every trigger that could be swept up in an
-- organization's deletion (jobs, candidates, and anything logged here
-- in future), make log_activity() itself defensive: if the given
-- organization no longer exists, log the entry with no organization
-- (admin-only visibility) instead of failing outright. This covers the
-- organization's own entry too, so the narrower null from 20261022193000
-- stays correct but is now redundant (harmless).
-- =====================================================================

create or replace function public.log_activity(
  p_organization_id uuid,
  p_entity_type     public.log_entity_type,
  p_entity_id       uuid,
  p_entity_label    text,
  p_action          public.log_action,
  p_details         jsonb default '{}'::jsonb,
  p_actor_override  uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := coalesce(p_actor_override, (select auth.uid()));
  v_email  text;
  v_role   public.user_role;
  v_org_id uuid := p_organization_id;
begin
  if v_actor is not null then
    select p.email, p.role into v_email, v_role from public.profiles p where p.id = v_actor;
  end if;

  if v_org_id is not null and not exists (
    select 1 from public.organizations o where o.id = v_org_id
  ) then
    v_org_id := null; -- already gone in this same transaction — don't fail the write over it
  end if;

  insert into public.activity_logs
    (organization_id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, details)
  values
    (v_org_id, v_actor, v_email, v_role, p_action, p_entity_type, p_entity_id, p_entity_label,
     coalesce(p_details, '{}'::jsonb));
end;
$$;
