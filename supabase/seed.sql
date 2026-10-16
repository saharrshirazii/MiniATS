-- =====================================================================
-- MiniATS · Demo seed data (closes #21)
--
-- 2 organizations, 4 jobs (2 each), 15 candidates spread across every
-- pipeline stage, plus 2 "talent pool" candidates with no application
-- (demos the Talent Pool filter) and one candidate applied to two jobs
-- in the same organization (demos "one candidate, several jobs").
--
-- Fixed UUIDs make this safe to re-run: `on conflict (id) do nothing`
-- means running it twice never duplicates rows.
--
-- NOTE: jobs and candidates below have no `created_by`, so each one's
-- "Created by" column shows a dash. That's cosmetic only — it doesn't
-- affect RLS, the Kanban board, or any acceptance criteria for this issue.
--
-- Run this at any point relative to creating the demo customer logins
-- (next step) — the two don't depend on each other.
--
-- How to run (this is seed DATA, not a migration — `db push` won't
-- apply it):
--   Supabase Dashboard → SQL Editor → paste this file → Run
--   or:  psql "$DATABASE_URL" -f supabase/seed.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------
insert into public.organizations (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Acme AB'),
  ('22222222-2222-2222-2222-222222222222', 'Nova Health')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Jobs (2 per organization)
-- ---------------------------------------------------------------------
insert into public.jobs (id, organization_id, title, description, location, workplace_type, status) values
  ('a1111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111111',
   'Frontend Developer',
   'Build and maintain our customer-facing React/TypeScript app, working closely with design and backend.',
   'Gothenburg, Sweden', 'hybrid', 'open'),
  ('a1111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111111',
   'Backend Developer',
   'Design and build APIs and data models on Node.js and PostgreSQL for our core product.',
   'Gothenburg, Sweden', 'remote', 'open'),
  ('a2222222-2222-2222-2222-222222222201', '22222222-2222-2222-2222-222222222222',
   'Product Designer',
   'Own end-to-end product design for our patient portal, from research to high-fidelity UI.',
   'Stockholm, Sweden', 'hybrid', 'open'),
  ('a2222222-2222-2222-2222-222222222202', '22222222-2222-2222-2222-222222222222',
   'Customer Success Manager',
   'Be the main point of contact for our clinic customers: onboarding, renewals, and support escalations.',
   'Stockholm, Sweden', 'on_site', 'open')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Candidates — Acme AB (8, incl. 1 talent-pool and 1 applied to 2 jobs)
-- ---------------------------------------------------------------------
insert into public.candidates (id, organization_id, full_name, email, phone, linkedin_url, notes) values
  ('c1111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111111',
   'Erik Andersson', 'erik.andersson@example.com', '+46 70 111 1101',
   'https://www.linkedin.com/in/erik-andersson', 'Applied through the careers page.'),
  ('c1111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111111',
   'Lisa Berg', 'lisa.berg@example.com', '+46 70 111 1102',
   'https://www.linkedin.com/in/lisa-berg', 'Strong portfolio, 4 years React experience.'),
  ('c1111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111111',
   'Max Karlsson', 'max.karlsson@example.com', '+46 70 111 1103',
   'https://www.linkedin.com/in/max-karlsson', 'Great first interview, moving to tech screen.'),
  ('c1111111-1111-1111-1111-111111111104', '11111111-1111-1111-1111-111111111111',
   'Johan Nilsson', 'johan.nilsson@example.com', '+46 70 111 1104',
   'https://www.linkedin.com/in/johan-nilsson', 'Senior backend profile, offer being drafted.'),
  ('c1111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111111',
   'Sara Lindqvist', 'sara.lindqvist@example.com', '+46 70 111 1105',
   'https://www.linkedin.com/in/sara-lindqvist', 'Accepted offer, start date TBD.'),
  ('c1111111-1111-1111-1111-111111111106', '11111111-1111-1111-1111-111111111111',
   'Pontus Dahl', 'pontus.dahl@example.com', '+46 70 111 1106',
   'https://www.linkedin.com/in/pontus-dahl', 'Not enough backend depth for this role.'),
  ('c1111111-1111-1111-1111-111111111107', '11111111-1111-1111-1111-111111111111',
   'Emma Sjögren', 'emma.sjogren@example.com', '+46 70 111 1107',
   'https://www.linkedin.com/in/emma-sjogren', 'Fullstack — being considered for both open roles.'),
  ('c1111111-1111-1111-1111-111111111108', '11111111-1111-1111-1111-111111111111',
   'Oskar Holm', 'oskar.holm@example.com', '+46 70 111 1108',
   'https://www.linkedin.com/in/oskar-holm', 'Reached out proactively; keep warm for future roles.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Candidates — Nova Health (7, incl. 1 talent-pool)
-- ---------------------------------------------------------------------
insert into public.candidates (id, organization_id, full_name, email, phone, linkedin_url, notes) values
  ('c2222222-2222-2222-2222-222222222201', '22222222-2222-2222-2222-222222222222',
   'Anna Berglund', 'anna.berglund@example.com', '+46 70 222 2201',
   'https://www.linkedin.com/in/anna-berglund', 'Applied through LinkedIn Jobs.'),
  ('c2222222-2222-2222-2222-222222222202', '22222222-2222-2222-2222-222222222222',
   'Victor Ström', 'victor.strom@example.com', '+46 70 222 2202',
   'https://www.linkedin.com/in/victor-strom', 'Good portfolio, scheduling a design review.'),
  ('c2222222-2222-2222-2222-222222222203', '22222222-2222-2222-2222-222222222222',
   'Clara Fogelström', 'clara.fogelstrom@example.com', '+46 70 222 2203',
   'https://www.linkedin.com/in/clara-fogelstrom', 'Strong healthcare UX background.'),
  ('c2222222-2222-2222-2222-222222222204', '22222222-2222-2222-2222-222222222222',
   'Daniel Ekström', 'daniel.ekstrom@example.com', '+46 70 222 2204',
   'https://www.linkedin.com/in/daniel-ekstrom', 'Offer sent, awaiting response.'),
  ('c2222222-2222-2222-2222-222222222205', '22222222-2222-2222-2222-222222222222',
   'Nora Lindberg', 'nora.lindberg@example.com', '+46 70 222 2205',
   'https://www.linkedin.com/in/nora-lindberg', 'Starts next month.'),
  ('c2222222-2222-2222-2222-222222222206', '22222222-2222-2222-2222-222222222222',
   'Marcus Åberg', 'marcus.aberg@example.com', '+46 70 222 2206',
   'https://www.linkedin.com/in/marcus-aberg', 'Went with another candidate for this round.'),
  ('c2222222-2222-2222-2222-222222222207', '22222222-2222-2222-2222-222222222222',
   'Ida Wallin', 'ida.wallin@example.com', '+46 70 222 2207',
   'https://www.linkedin.com/in/ida-wallin', 'No open match yet; keep in the talent pool.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Applications — Acme AB (8 cards across all 6 stages)
-- ---------------------------------------------------------------------
insert into public.applications (job_id, candidate_id, stage, position) values
  ('a1111111-1111-1111-1111-111111111101', 'c1111111-1111-1111-1111-111111111101', 'applied', 0),
  ('a1111111-1111-1111-1111-111111111101', 'c1111111-1111-1111-1111-111111111102', 'screening', 0),
  ('a1111111-1111-1111-1111-111111111101', 'c1111111-1111-1111-1111-111111111103', 'interview', 0),
  ('a1111111-1111-1111-1111-111111111101', 'c1111111-1111-1111-1111-111111111107', 'interview', 1),
  ('a1111111-1111-1111-1111-111111111102', 'c1111111-1111-1111-1111-111111111104', 'offer', 0),
  ('a1111111-1111-1111-1111-111111111102', 'c1111111-1111-1111-1111-111111111105', 'hired', 0),
  ('a1111111-1111-1111-1111-111111111102', 'c1111111-1111-1111-1111-111111111106', 'rejected', 0),
  ('a1111111-1111-1111-1111-111111111102', 'c1111111-1111-1111-1111-111111111107', 'screening', 1)
on conflict (job_id, candidate_id) do nothing;

-- ---------------------------------------------------------------------
-- Applications — Nova Health (6 cards across all 6 stages)
-- ---------------------------------------------------------------------
insert into public.applications (job_id, candidate_id, stage, position) values
  ('a2222222-2222-2222-2222-222222222201', 'c2222222-2222-2222-2222-222222222201', 'applied', 0),
  ('a2222222-2222-2222-2222-222222222201', 'c2222222-2222-2222-2222-222222222202', 'screening', 0),
  ('a2222222-2222-2222-2222-222222222201', 'c2222222-2222-2222-2222-222222222203', 'interview', 0),
  ('a2222222-2222-2222-2222-222222222202', 'c2222222-2222-2222-2222-222222222204', 'offer', 0),
  ('a2222222-2222-2222-2222-222222222202', 'c2222222-2222-2222-2222-222222222205', 'hired', 0),
  ('a2222222-2222-2222-2222-222222222202', 'c2222222-2222-2222-2222-222222222206', 'rejected', 0)
on conflict (job_id, candidate_id) do nothing;
