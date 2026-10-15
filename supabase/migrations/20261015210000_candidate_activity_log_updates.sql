-- =====================================================================
-- MiniATS · Candidates → activity log, field-level edits
--
-- Candidate editing (full_name, email, phone, linkedin_url, notes — the
-- fields the candidate detail panel can change) now logs an 'updated'
-- entry, the same way jobs already do. This was the known gap left by
-- 20261015130100 ("basic tier" — created/deleted only).
--
-- cv_path is deliberately NOT tracked: it is only ever set once, right
-- after insert, as part of the CV-upload step of candidate creation
-- (see useCreateCandidate) — not something the edit form can change —
-- so logging it would just add a confusing "updated" entry immediately
-- after every "created" entry for candidates with a CV attached.
--
-- `notes` is free text like a job's `description`, so changed_fields()
-- now records "changed: true" for it too instead of the full before/after
-- text (which would otherwise bloat every entry and clutter the log UI).
-- =====================================================================

create or replace function public.changed_fields(p_old jsonb, p_new jsonb, p_fields text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      f,
      case when f in ('description', 'notes') then jsonb_build_object('changed', true)
           else jsonb_build_object('from', p_old -> f, 'to', p_new -> f) end
    ),
    '{}'::jsonb
  )
  from unnest(p_fields) as f
  where (p_old -> f) is distinct from (p_new -> f);
$$;

create or replace function public.log_candidate_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'candidate', new.id, new.full_name, 'created');
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.log_activity(old.organization_id, 'candidate', old.id, old.full_name, 'deleted_permanently');
    return null;
  end if;

  -- UPDATE
  v_changes := public.changed_fields(
    to_jsonb(old), to_jsonb(new),
    array['full_name', 'email', 'phone', 'linkedin_url', 'notes']
  );

  if v_changes = '{}'::jsonb then
    return null; -- nothing worth logging (e.g. only updated_at, or the cv_path backfill)
  end if;

  perform public.log_activity(
    new.organization_id, 'candidate', new.id, new.full_name, 'updated',
    jsonb_build_object('changes', v_changes)
  );
  return null;
end;
$$;

drop trigger if exists candidates_log_activity on public.candidates;

create trigger candidates_log_activity
  after insert or update or delete on public.candidates
  for each row execute function public.log_candidate_activity();
