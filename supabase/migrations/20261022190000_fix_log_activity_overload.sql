-- =====================================================================
-- MiniATS · Fix ambiguous log_activity overload
--
-- 20261022180100_user_org_activity_log.sql added a 7th parameter
-- (p_actor_override) to log_activity() via `create or replace function`.
-- Postgres only replaces a function in place when its parameter types
-- are unchanged — adding a parameter instead creates a SECOND, separate
-- overload and leaves the old 6-parameter one in the catalog. Every
-- existing trigger (jobs, candidates, organizations, profiles) calls
-- log_activity() with 5–6 arguments, which both overloads now accept
-- via their own trailing defaults — Postgres can't pick one:
--
--   function public.log_activity(uuid, unknown, uuid, text, unknown)
--   is not unique
--
-- Drop the stale 6-parameter overload so only the 7-parameter version
-- remains; every existing call site keeps working unchanged (p_actor_override
-- just defaults to null, same as before this ever existed).
-- =====================================================================

drop function if exists public.log_activity(
  uuid, public.log_entity_type, uuid, text, public.log_action, jsonb
);
