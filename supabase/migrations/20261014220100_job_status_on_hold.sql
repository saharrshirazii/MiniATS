-- =====================================================================
-- MiniATS · Jobs on hold
--
-- "On hold" pauses recruiting for an open job: it keeps its candidates
-- and can be edited or reopened.
-- =====================================================================

alter type public.job_status add value if not exists 'on_hold' after 'open';
