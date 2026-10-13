-- =====================================================================
-- MiniATS · Row Level Security
--
-- Rules:
--   • admin    → full access to every row (to act on a customer's behalf)
--   • customer → only rows of their own organization
--   • anon     → nothing
--
-- Calls are wrapped in (select ...) so Postgres evaluates them once per
-- query instead of once per row (Supabase performance recommendation).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions
-- security definer: they read profiles without triggering profiles' own
-- RLS policies, which would otherwise recurse.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.my_org()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_org()   from public, anon;
grant  execute on function public.is_admin() to authenticated;
grant  execute on function public.my_org()   to authenticated;

-- Internal trigger functions must not be callable through the API.
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.check_application_same_org() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Defense in depth: anonymous users get no table access at all.
-- ---------------------------------------------------------------------
revoke all on public.organizations, public.profiles, public.jobs,
              public.candidates, public.applications
  from anon;

-- ---------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.jobs          enable row level security;
alter table public.candidates    enable row level security;
alter table public.applications  enable row level security;

-- ---------------------------------------------------------------------
-- organizations: customers can read their own; only admins can change
-- ---------------------------------------------------------------------
create policy "organizations: read own or admin"
  on public.organizations for select
  to authenticated
  using ((select public.is_admin()) or id = (select public.my_org()));

create policy "organizations: admin can insert"
  on public.organizations for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "organizations: admin can update"
  on public.organizations for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "organizations: admin can delete"
  on public.organizations for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- profiles: users read their own; admins read and manage all.
-- Profiles are created by the on_auth_user_created trigger, so there is
-- no insert policy. Customers cannot update their profile (and so cannot
-- change their own role or organization).
-- ---------------------------------------------------------------------
create policy "profiles: read own or admin"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()) or id = (select auth.uid()));

create policy "profiles: admin can update"
  on public.profiles for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "profiles: admin can delete"
  on public.profiles for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- jobs: full access within own organization; admin everywhere
-- ---------------------------------------------------------------------
create policy "jobs: own organization or admin"
  on public.jobs for all
  to authenticated
  using ((select public.is_admin()) or organization_id = (select public.my_org()))
  with check ((select public.is_admin()) or organization_id = (select public.my_org()));

-- ---------------------------------------------------------------------
-- candidates: full access within own organization; admin everywhere
-- ---------------------------------------------------------------------
create policy "candidates: own organization or admin"
  on public.candidates for all
  to authenticated
  using ((select public.is_admin()) or organization_id = (select public.my_org()))
  with check ((select public.is_admin()) or organization_id = (select public.my_org()));

-- ---------------------------------------------------------------------
-- applications: no organization_id column, so check through the job.
-- (The same-organization trigger guarantees the candidate matches.)
-- ---------------------------------------------------------------------
create policy "applications: own organization or admin"
  on public.applications for all
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.jobs j
      where j.id = applications.job_id
        and j.organization_id = (select public.my_org())
    )
  )
  with check (
    (select public.is_admin())
    or exists (
      select 1
      from public.jobs j
      where j.id = applications.job_id
        and j.organization_id = (select public.my_org())
    )
  );
