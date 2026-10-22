-- =====================================================================
-- MiniATS · Organizations and users → activity log, part 1/2
--
-- A new enum value cannot be used in the same transaction that adds it
-- (Postgres restriction), and Supabase runs each migration file as one
-- transaction. So the values are added here, and everything that uses
-- them (triggers, functions, backfill) lives in the next migration.
-- =====================================================================

alter type public.log_entity_type add value 'organization';
alter type public.log_entity_type add value 'user';
