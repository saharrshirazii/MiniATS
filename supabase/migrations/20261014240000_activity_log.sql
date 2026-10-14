-- =====================================================================
-- MiniATS · Activity log
--
--   • One append-only table, activity_logs, written ONLY by database
--     triggers (clients can read, never write), so entries can't be
--     skipped or faked from the browser.
--   • Who did it comes from the signed-in user (auth.uid()); scheduled
--     jobs (pg_cron purge) have no user and show as "System".
--   • Admins read every entry; customers read their organization's
--     entries, including what an admin did on their behalf.
--   • Jobs are logged now; candidates and pipeline moves hook into the
--     same table (new enum values + triggers) when they are built.
-- =====================================================================

create type public.log_action as enum (
  'created',
  'updated',
  'status_changed',
  'deleted',             -- soft delete
  'restored',
  'deleted_permanently'
);

create type public.log_entity_type as enum ('job');

create table public.activity_logs (
  id               bigint generated always as identity primary key,
  -- Kept (set null) if the organization is ever deleted, so admins keep the history.
  organization_id  uuid references public.organizations (id) on delete set null,
  actor_id         uuid,          -- no FK: entries outlive deleted users
  actor_email      text,          -- snapshot; null = System
  actor_role       public.user_role,
  action           public.log_action not null,
  entity_type      public.log_entity_type not null,
  entity_id        uuid not null, -- no FK: entries outlive deleted items
  entity_label     text not null, -- snapshot, e.g. the job title at the time
  details          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index activity_logs_org_created_at_idx on public.activity_logs (organization_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- RLS: read-only for clients. No insert/update/delete policies, and the
-- privileges are revoked too, so the log is append-only via triggers.
-- ---------------------------------------------------------------------
alter table public.activity_logs enable row level security;

revoke insert, update, delete, truncate on public.activity_logs from anon, authenticated;

create policy "activity_logs: read own organization or admin"
  on public.activity_logs for select
  to authenticated
  using ((select public.is_admin()) or organization_id = (select public.my_org()));

-- ---------------------------------------------------------------------
-- log_activity: append one entry for the current user. Only callable
-- from triggers / other security-definer functions, not from the API.
-- ---------------------------------------------------------------------
create or replace function public.log_activity(
  p_organization_id uuid,
  p_entity_type     public.log_entity_type,
  p_entity_id       uuid,
  p_entity_label    text,
  p_action          public.log_action,
  p_details         jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
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

revoke execute on function public.log_activity(uuid, public.log_entity_type, uuid, text, public.log_action, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- changed_fields: {"field": {"from": …, "to": …}} for the given fields
-- that differ between two row versions. Long text (description) only
-- records that it changed.
-- ---------------------------------------------------------------------
create or replace function public.changed_fields(p_old jsonb, p_new jsonb, p_fields text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      f,
      case when f = 'description' then jsonb_build_object('changed', true)
           else jsonb_build_object('from', p_old -> f, 'to', p_new -> f) end
    ),
    '{}'::jsonb
  )
  from unnest(p_fields) as f
  where (p_old -> f) is distinct from (p_new -> f);
$$;

-- ---------------------------------------------------------------------
-- Jobs → activity log
-- ---------------------------------------------------------------------
create or replace function public.log_job_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'job', new.id, new.title, 'created',
      jsonb_build_object('status', new.status));
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.log_activity(old.organization_id, 'job', old.id, old.title, 'deleted_permanently',
      jsonb_build_object('status', old.status));
    return null;
  end if;

  -- UPDATE
  if old.deleted_at is null and new.deleted_at is not null then
    perform public.log_activity(new.organization_id, 'job', new.id, new.title, 'deleted',
      jsonb_build_object('status', new.status));
    return null;
  end if;

  if old.deleted_at is not null and new.deleted_at is null then
    perform public.log_activity(new.organization_id, 'job', new.id, new.title, 'restored',
      jsonb_build_object('status', new.status));
    return null;
  end if;

  v_changes := public.changed_fields(
    to_jsonb(old), to_jsonb(new),
    array['title', 'location', 'workplace_type', 'description', 'status', 'organization_id']
  );

  if v_changes = '{}'::jsonb then
    return null; -- nothing worth logging (e.g. only updated_at)
  end if;

  perform public.log_activity(
    new.organization_id, 'job', new.id, new.title,
    case when v_changes ? 'status' then 'status_changed' else 'updated' end::public.log_action,
    jsonb_build_object('changes', v_changes)
  );
  return null;
end;
$$;

revoke execute on function public.log_job_activity() from public, anon, authenticated;

create trigger jobs_log_activity
  after insert or update or delete on public.jobs
  for each row execute function public.log_job_activity();

-- ---------------------------------------------------------------------
-- activity_log_actors: the people who appear in the log the caller can
-- see (for the "User" filter). Security invoker, so RLS applies.
-- ---------------------------------------------------------------------
create or replace function public.activity_log_actors(p_organization_id uuid default null)
returns table (actor_email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct l.actor_email
  from public.activity_logs l
  where l.actor_email is not null
    and (p_organization_id is null or l.organization_id = p_organization_id)
  order by 1;
$$;

revoke execute on function public.activity_log_actors(uuid) from public, anon;
grant  execute on function public.activity_log_actors(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Backfill: a "created" entry for every job that already exists.
-- ---------------------------------------------------------------------
insert into public.activity_logs
  (organization_id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, details, created_at)
select j.organization_id, p.id, j.created_by_email, p.role, 'created', 'job', j.id, j.title,
       jsonb_build_object('status', j.status), j.created_at
from public.jobs j
left join public.profiles p on p.email = j.created_by_email;
