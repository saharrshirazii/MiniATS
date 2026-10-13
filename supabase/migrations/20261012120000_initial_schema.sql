-- =====================================================================
-- MiniATS · Initial schema
-- Tables: organizations, profiles, jobs, candidates, applications
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'customer');

create type public.job_status as enum ('open', 'closed');

create type public.application_stage as enum (
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected'
);

-- ---------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- organizations: a customer company
-- ---------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- profiles: one row per auth user, holds role and organization
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  role             public.user_role not null default 'customer',
  organization_id  uuid references public.organizations (id) on delete restrict,
  email            text,
  full_name        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- organization_id is nullable on purpose: admins have none, and users created
-- from the Supabase dashboard start without one. A customer without an
-- organization simply sees no data (my_org() returns null in RLS).

create index profiles_organization_id_idx on public.profiles (organization_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when an auth user is created.
-- Role and organization are read from app_metadata, which only the
-- service role (our create-user Edge Function) can set. Users cannot
-- change app_metadata themselves, so nobody can make themselves admin.
-- Users created without metadata (e.g. from the dashboard) become a
-- customer without an organization until an admin assigns one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, organization_id, email, full_name)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'customer'),
    (new.raw_app_meta_data ->> 'organization_id')::uuid,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- jobs: positions an organization is recruiting for
-- ---------------------------------------------------------------------
create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null check (char_length(trim(title)) between 1 and 200),
  description      text,
  location         text,
  status           public.job_status not null default 'open',
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index jobs_organization_id_idx on public.jobs (organization_id);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- candidates: people in an organization's talent pool
-- ---------------------------------------------------------------------
create table public.candidates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  full_name        text not null check (char_length(trim(full_name)) between 1 and 200),
  email            text,
  phone            text,
  linkedin_url     text check (linkedin_url is null or linkedin_url ~* '^https?://'),
  cv_path          text,  -- path in the private "cvs" storage bucket
  notes            text,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index candidates_organization_id_idx on public.candidates (organization_id);

create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- applications: a candidate in a job's pipeline (= one Kanban card)
-- ---------------------------------------------------------------------
create table public.applications (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs (id) on delete cascade,
  candidate_id   uuid not null references public.candidates (id) on delete cascade,
  stage          public.application_stage not null default 'applied',
  position       integer not null default 0,  -- order within a Kanban column
  ai_score       integer check (ai_score between 0 and 100),
  ai_summary     text,
  ai_assessed_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint applications_job_candidate_unique unique (job_id, candidate_id)
);

create index applications_candidate_id_idx on public.applications (candidate_id);
create index applications_job_stage_position_idx on public.applications (job_id, stage, position);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- A candidate can only apply to jobs in the same organization.
-- security definer: the check must see the real organization of both rows,
-- even rows hidden from the caller by RLS.
create or replace function public.check_application_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_org        uuid;
  candidate_org  uuid;
begin
  select organization_id into job_org from public.jobs where id = new.job_id;
  select organization_id into candidate_org from public.candidates where id = new.candidate_id;

  if job_org is distinct from candidate_org then
    raise exception 'Candidate and job must belong to the same organization'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger applications_check_same_org
  before insert or update of job_id, candidate_id on public.applications
  for each row execute function public.check_application_same_org();
