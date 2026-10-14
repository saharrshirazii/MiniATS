-- =====================================================================
-- MiniATS · Draft jobs
--
-- A draft is a job that is not published yet. It only needs a title;
-- the app requires the other details before it can be published (open).
-- =====================================================================

alter type public.job_status add value if not exists 'draft' before 'open';
