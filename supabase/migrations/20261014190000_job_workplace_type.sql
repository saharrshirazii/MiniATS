-- =====================================================================
-- MiniATS · Work place type for jobs (On-site / Hybrid / Remote)
--
-- Nullable so existing jobs stay valid; the app requires it for new jobs.
-- =====================================================================

create type public.workplace_type as enum ('on_site', 'hybrid', 'remote');

alter table public.jobs
  add column workplace_type public.workplace_type;
