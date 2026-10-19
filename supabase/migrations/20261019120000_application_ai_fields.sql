-- =====================================================================
-- MiniATS · AI CV assessment fields (#24)
--
-- applications.ai_score / ai_summary / ai_assessed_at already exist
-- (initial schema). Strengths and gaps are small, fixed-shape lists —
-- plain text arrays, not a new table — so no RLS or joins are needed to
-- read them; they're just more columns on a row the caller already has
-- access to.
-- =====================================================================

alter table public.applications
  add column if not exists ai_strengths text[],
  add column if not exists ai_gaps      text[];

comment on column public.applications.ai_strengths is
  'AI-generated: up to 5 short strengths from the CV assessment. Advisory only — never acted on automatically.';
comment on column public.applications.ai_gaps is
  'AI-generated: up to 5 short gaps/concerns from the CV assessment. Advisory only — never acted on automatically.';
