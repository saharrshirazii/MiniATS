-- =====================================================================
-- MiniATS · Organizations and users → activity log, part 2/2
--
-- Two different attribution paths, because these two entities are
-- written through two different routes:
--
--   • Organizations are always created/renamed/deleted by a direct,
--     authenticated client call (RLS-checked), so auth.uid() reliably
--     identifies the admin doing it — a plain trigger, like jobs.
--   • Role/organization/name edits on an existing user (useUpdateUser)
--     are also a direct authenticated call, so the same applies there.
--   • But a user is created and deleted through the admin-only
--     create-user / delete-user Edge Functions, which run under the
--     service-role key with no JWT forwarded — auth.uid() would be
--     null there ("System"), even though a specific admin triggered
--     it. Those two functions already verify the caller is an admin
--     (requireAdmin) before doing anything, so they pass that admin's
--     id in explicitly via log_user_activity() instead of relying on
--     auto-detection.
-- =====================================================================

-- ---------------------------------------------------------------------
-- log_activity: accept an explicit actor override, falling back to
-- auth.uid() as before when it's not given.
-- ---------------------------------------------------------------------
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
  v_actor uuid := coalesce(p_actor_override, (select auth.uid()));
  v_email text;
  v_role  public.user_role;
begin
  if v_actor is not null then
    select p.email, p.role into v_email, v_role from public.profiles p where p.id = v_actor;
  end if;

  insert into public.activity_logs
    (organization_id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, details)
  values
    (p_organization_id, v_actor, v_email, v_role, p_action, p_entity_type, p_entity_id, p_entity_label,
     coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Organizations → activity log
-- ---------------------------------------------------------------------
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
    perform public.log_activity(old.id, 'organization', old.id, old.name, 'deleted_permanently');
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

revoke execute on function public.log_organization_activity() from public, anon, authenticated;

create trigger organizations_log_activity
  after insert or update or delete on public.organizations
  for each row execute function public.log_organization_activity();

-- ---------------------------------------------------------------------
-- Users (profiles) → activity log, edits only (see header comment for
-- why creation/deletion are logged a different way).
-- ---------------------------------------------------------------------
create or replace function public.log_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  v_changes := public.changed_fields(
    to_jsonb(old), to_jsonb(new), array['role', 'organization_id', 'full_name']
  );
  if v_changes = '{}'::jsonb then
    return null; -- nothing worth logging (e.g. only updated_at, or email changes — not editable in the UI)
  end if;

  perform public.log_activity(
    new.organization_id, 'user', new.id, coalesce(new.full_name, new.email), 'updated',
    jsonb_build_object('changes', v_changes)
  );
  return null;
end;
$$;

revoke execute on function public.log_profile_activity() from public, anon, authenticated;

create trigger profiles_log_activity
  after update on public.profiles
  for each row execute function public.log_profile_activity();

-- ---------------------------------------------------------------------
-- log_user_activity: thin wrapper for create-user / delete-user to log
-- a "created" / "deleted_permanently" entry with the verified admin's id
-- as actor. Not callable by authenticated/anon — p_actor_id would
-- otherwise let any signed-in caller attribute an entry to anyone.
-- Only the service-role key (the Edge Functions) can call this.
-- ---------------------------------------------------------------------
create or replace function public.log_user_activity(
  p_id uuid,
  p_organization_id uuid,
  p_label text,
  p_action public.log_action,
  p_actor_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.log_activity(p_organization_id, 'user', p_id, p_label, p_action, '{}'::jsonb, p_actor_id);
$$;

revoke execute on function public.log_user_activity(uuid, uuid, text, public.log_action, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Backfill: a "created" entry for every organization and user that
-- already exists. There's no record of who created historical rows, so
-- these show as "System" — accurate going forward is what matters.
-- ---------------------------------------------------------------------
insert into public.activity_logs
  (organization_id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, details, created_at)
select o.id, null, null, null, 'created', 'organization', o.id, o.name, '{}'::jsonb, o.created_at
from public.organizations o;

insert into public.activity_logs
  (organization_id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, details, created_at)
select p.organization_id, null, null, null, 'created', 'user', p.id, coalesce(p.full_name, p.email), '{}'::jsonb, p.created_at
from public.profiles p;
