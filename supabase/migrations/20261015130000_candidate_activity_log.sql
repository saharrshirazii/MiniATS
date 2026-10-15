-- =====================================================================
-- MiniATS · Candidates → activity log (basic tier), part 1/2
--
-- A new enum value cannot be used in the same transaction that adds it
-- (Postgres restriction — "unsafe use of new value of enum type"), and
-- Supabase runs each migration file as one transaction. So the value is
-- added here, and the trigger + backfill that use it live in the next
-- migration file.
-- =====================================================================

alter type public.log_entity_type add value 'candidate';
