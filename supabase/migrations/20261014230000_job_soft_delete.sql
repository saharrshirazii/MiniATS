-- =====================================================================
-- MiniATS · Soft delete for jobs, permanent deletion after 90 days
--
--   • Drafts are deleted permanently right away (no candidates, no history).
--   • Other jobs are soft-deleted: hidden from customers (and their
--     pipeline with them), recorded who/when, restorable by admins.
--   • A nightly pg_cron job permanently deletes jobs soft-deleted more
--     than 90 days ago.
--
-- Soft delete and restore go through security-definer functions, and a
-- trigger stops clients from setting deleted_at / deleted_by_email
-- directly, so "who deleted it" cannot be spoofed.
-- =====================================================================

alter table public.jobs
  add column deleted_at timestamptz,
  add column deleted_by_email text;

create index jobs_deleted_at_idx on public.jobs (deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------
-- Clients (role "authenticated") may not touch the soft-delete columns.
-- The functions below run as their owner, so they can.
-- ---------------------------------------------------------------------
create or replace function public.guard_job_soft_delete_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.deleted_at := null;
      new.deleted_by_email := null;
    else
      new.deleted_at := old.deleted_at;
      new.deleted_by_email := old.deleted_by_email;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_job_soft_delete_columns() from public, anon, authenticated;

create trigger jobs_guard_soft_delete
  before insert or update on public.jobs
  for each row execute function public.guard_job_soft_delete_columns();

-- ---------------------------------------------------------------------
-- RLS: replace the single "for all" policy with per-command policies so
-- customers never see (or change) soft-deleted jobs. Admins still see
-- them, to restore or delete them permanently.
-- applications/candidates checks go through jobs, so a deleted job's
-- pipeline is hidden from customers too.
-- ---------------------------------------------------------------------
drop policy "jobs: own organization or admin" on public.jobs;

create policy "jobs: read own organization (not deleted) or admin"
  on public.jobs for select
  to authenticated
  using (
    (select public.is_admin())
    or (organization_id = (select public.my_org()) and deleted_at is null)
  );

create policy "jobs: insert into own organization or admin"
  on public.jobs for insert
  to authenticated
  with check ((select public.is_admin()) or organization_id = (select public.my_org()));

create policy "jobs: update own organization (not deleted) or admin"
  on public.jobs for update
  to authenticated
  using (
    (select public.is_admin())
    or (organization_id = (select public.my_org()) and deleted_at is null)
  )
  with check ((select public.is_admin()) or organization_id = (select public.my_org()));

-- Permanent delete: customers only for their drafts; admins for anything.
create policy "jobs: delete own drafts or admin"
  on public.jobs for delete
  to authenticated
  using (
    (select public.is_admin())
    or (
      organization_id = (select public.my_org())
      and status = 'draft'
      and deleted_at is null
    )
  );

-- ---------------------------------------------------------------------
-- soft_delete_job: hide a job and record who deleted it.
-- ---------------------------------------------------------------------
create or replace function public.soft_delete_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id;

  if not found
     or v_job.deleted_at is not null
     or not ((select public.is_admin()) or v_job.organization_id = (select public.my_org())) then
    raise exception 'Job not found, or you are not allowed to delete it.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_job.status not in ('open', 'on_hold') then
    raise exception 'Only open or on-hold jobs can be deleted this way.'
      using errcode = 'check_violation';
  end if;

  update public.jobs
  set deleted_at = now(),
      deleted_by_email = (select email from public.profiles where id = (select auth.uid()))
  where id = p_job_id;
end;
$$;

-- ---------------------------------------------------------------------
-- restore_job: admins bring a soft-deleted job back.
-- ---------------------------------------------------------------------
create or replace function public.restore_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can restore jobs.' using errcode = 'insufficient_privilege';
  end if;

  update public.jobs
  set deleted_at = null,
      deleted_by_email = null
  where id = p_job_id and deleted_at is not null;

  if not found then
    raise exception 'Deleted job not found.' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- purge_deleted_jobs: permanently delete jobs soft-deleted long enough ago.
-- Runs nightly (pg_cron, below). Not callable from the API.
-- ---------------------------------------------------------------------
create or replace function public.purge_deleted_jobs(p_retention interval default interval '90 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.jobs
  where deleted_at is not null
    and deleted_at < now() - p_retention;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.soft_delete_job(uuid)        from public, anon;
revoke execute on function public.restore_job(uuid)            from public, anon;
revoke execute on function public.purge_deleted_jobs(interval) from public, anon, authenticated;
grant  execute on function public.soft_delete_job(uuid)        to authenticated;
grant  execute on function public.restore_job(uuid)            to authenticated;

-- ---------------------------------------------------------------------
-- Nightly purge at 03:15 UTC with pg_cron (available on Supabase).
-- Skipped where pg_cron isn't installed (e.g. some local setups).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'purge-deleted-jobs',
      '15 3 * * *',
      'select public.purge_deleted_jobs()'
    );
  else
    raise notice 'pg_cron is not available: schedule public.purge_deleted_jobs() manually.';
  end if;
end;
$$;
