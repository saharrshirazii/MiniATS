-- =====================================================================
-- MiniATS · Archived jobs
--
-- Lifecycle: draft → open ⇄ on hold, open → closed → archived.
-- Closed jobs can only be archived (no edit, no reopen); archived jobs are
-- kept as read-only history and hidden from the "All" list.
-- =====================================================================

alter type public.job_status add value if not exists 'archived' after 'closed';
