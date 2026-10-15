# CLAUDE.md – MiniATS

Context for AI coding assistants (Claude Code, Cursor, etc.). Read this before doing any work in this repo.

## Project

**MiniATS** is a mini Applicant Tracking System built as a job-application assignment.
Goal: something a first customer can use **as quickly as possible**.

- **Deadline:** Friday 16 October 2026 (deliver before noon). Work started Monday 12 October.
- **Developer:** Sahar, a fullstack developer (React, TypeScript, Tailwind, Node.js, PostgreSQL). Explain non-obvious decisions briefly; no need to explain basics.
- **Repo is public.** Reviewers will read the code: keep it clean, typed and readable.

### Required features (from the assignment)
1. Admin can create accounts (both admin and customer accounts).
2. Customer can log in.
3. Customer can post jobs they are recruiting for.
4. Customer can add candidates with profile info (e.g. LinkedIn link).
5. Customer sees a **compact Kanban** of all candidates linked to their jobs.
6. Customer can **filter the Kanban by job and candidate name**.
7. Admin can do everything a customer can, **on the customer's behalf**.

**Extra (AI):** simple AI-based assessment of a candidate's CV (at minimum, explain the approach in the demo).

### Delivery
- Admin login for the reviewer
- 5-minute Loom demo
- Email with assumptions
- Public repo link
- Ship often (first delivery planned Wed 14 Oct)

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling / UI | Tailwind CSS + shadcn/ui |
| Routing | React Router |
| Data fetching | @tanstack/react-query + @supabase/supabase-js |
| Forms | react-hook-form + zod |
| Drag and drop | @dnd-kit/core |
| Backend | Supabase (Auth, Postgres, RLS, Storage, Edge Functions) |
| Hosting | Vercel — https://mini-ats-three.vercel.app (auto-deploys on push to `main`) |

## Architecture decisions (assumptions)

1. **Customer = organization.** A customer is a company (`organizations`) that can have several users. Data is scoped by `organization_id`.
2. **No public sign-up.** Only admins create accounts, through the `create-user` Edge Function. Public sign-up is disabled in Supabase Auth.
3. **Admin "acts on behalf" via an organization selector**, not real impersonation. Admins can access all rows through RLS; the UI has an "Acting as: <Org>" dropdown that scopes queries and inserts.
4. **The Kanban shows applications, not candidates.** One candidate can apply to several jobs; each `applications` row is one card.
5. **Fixed pipeline stages:** `applied → screening → interview → offer → hired | rejected`.
6. **CVs** are PDFs in a private Supabase Storage bucket `cvs`, accessed through signed URLs.

## Data model

```
organizations (id, name, created_at)
profiles      (id → auth.users, role: admin|customer, organization_id → organizations [null for admins], full_name)
jobs          (id, organization_id, title, description, location, status: open|closed, created_at)
candidates    (id, organization_id, full_name, email, phone, linkedin_url, cv_path, notes, created_at)
applications  (id, job_id, candidate_id, stage, position, ai_score, ai_summary, created_at)
              unique (job_id, candidate_id)
```

## Security rules (must follow)

- **RLS is enabled on every table.** Helper functions `is_admin()` and `my_org()` (SQL, `security definer`).
  - Admin: full access to all rows.
  - Customer: only rows where `organization_id = my_org()`. `applications` checks the organization through its job.
- **Never** use the `service_role` key in frontend code. Never prefix it with `VITE_`. It is only used inside Edge Functions.
- Edge Functions verify the caller's JWT and role before doing privileged work.
- Secrets (LLM API key, etc.) are stored with `supabase secrets set`, never committed.

## Project structure

```
├── CLAUDE.md
├── README.md
├── .env.example
├── supabase/
│   ├── config.toml
│   ├── migrations/          # schema, RLS, seed: timestamped SQL files
│   ├── seed.sql
│   └── functions/
│       ├── create-user/     # admin-only account creation
│       └── assess-cv/       # AI CV assessment
└── src/
    ├── main.tsx
    ├── App.tsx              # routes
    ├── lib/                 # supabase client, utils
    ├── types/               # generated Supabase types (database.types.ts)
    ├── contexts/            # AuthContext, OrgContext (admin "acting as")
    ├── hooks/               # react-query hooks: useJobs, useCandidates, useApplications
    ├── components/
    │   ├── ui/              # shadcn/ui components
    │   ├── layout/          # AppLayout, Sidebar, Header, OrgSelector
    │   └── kanban/          # KanbanBoard, KanbanColumn, CandidateCard, KanbanFilters
    └── pages/
        ├── LoginPage.tsx
        ├── KanbanPage.tsx
        ├── JobsPage.tsx
        ├── CandidatesPage.tsx
        └── admin/           # OrganizationsPage, UsersPage
```

## Conventions

- TypeScript strict mode; no `any`.
- Use generated Supabase types: run `npm run db:types` after every migration (writes `src/types/database.types.ts`). Use the `Tables<"jobs">` / `TablesInsert<"jobs">` / `Enums<"application_stage">` helpers.
- Import with the `@/` alias (`@/lib/supabase`, `@/components/ui/button`).
- UI components come from shadcn/ui: add new ones with `npx shadcn@latest add <name>` (e.g. `dialog`, `select`, `sheet`, `badge`, `sonner`). Don't hand-roll components shadcn already provides.
- Run the Supabase CLI via `npx supabase …` (installed as a dev dependency).
- Before committing: `npm run build` and `npm run lint` must pass.
- Data access goes through react-query hooks in `src/hooks/`, not directly in components.
- Customer-data pages (jobs, candidates, kanban) are scoped with `useActiveOrg()`: query by `activeOrgId` and insert with `organization_id: activeOrgId`. Admins pick it in the header "Organization" selector, which also has **All** (`isAll === true`, `activeOrgId === null`): then list data from every organization (show an Organization column) and make create forms ask for the organization. Customers are fixed to their own organization.
- Job lifecycle: `draft` (only a title required) → `open` ⇄ `on_hold` (paused; Edit + Reopen), `open` → `closed` → `archived`. Publishing a draft requires a work place type. Closed and archived jobs can't be edited; closed can only be archived; archived jobs are read-only history, hidden from the "All" tab. Deleting: drafts are deleted permanently; open and on-hold jobs are **soft-deleted** (`soft_delete_job` RPC sets `deleted_at` / `deleted_by_email`; clients can't set these columns). RLS hides soft-deleted jobs (and their pipeline) from customers; admins see them in the **Deleted** tab and can restore (`restore_job`) or delete permanently. pg_cron runs `purge_deleted_jobs()` nightly to hard-delete jobs deleted more than 90 days ago. Rules live in `src/lib/job-status.ts`.
- **Activity log** (`activity_logs`, page `/activity`): append-only, written **only by database triggers** via `log_activity()` (clients can read, never write). Actor comes from `auth.uid()`; no user (pg_cron) = "System". Admins read all entries; customers read their organization's, including admin actions (labelled "Admin"). Filtering, search and paging (25/page) run in the database. **When adding a table that should be logged** (candidates, applications): add values to the `log_entity_type` / `log_action` enums and an `after insert or update or delete` trigger that calls `log_activity()`, in a new migration.
- **Candidates** (`candidates`, page `/candidates`): the "New candidate" dialog creates a `candidates` row and, when a job is chosen (vs. "General"), an `applications` row at stage `applied` — the two inserts are in `useCreateCandidate` (candidate first, then application; the candidate is rolled back if the application insert fails). "Attach CV" posts a PDF to the `parse-cv` Edge Function, which extracts contact details to pre-fill the form (it only fills empty fields). **LinkedIn URLs can't be scraped**, so enrichment is CV-based. CV *storage* (private `cvs` bucket) and the candidate detail panel are still to do (#16, #17).
- **Pipeline / Kanban** (`/`, the `applications` table): one board per organization (admins on "All" are asked to pick one — mixing organizations in one board would be confusing for drag and drop). Columns are the fixed `application_stage` values (`src/lib/constants.ts` → `STAGES`). Drag and drop (`@dnd-kit`) is optimistic: `useMoveApplication` updates the query cache immediately and rolls back on error; dropping renumbers `position` (0, 1, 2…) within the affected column(s) via `src/components/kanban/KanbanBoard.tsx`. Job and candidate-name filters live in the URL (`?job=`, `?q=`, shareable) via `useSearchParams`.
- "Created by" on jobs is `jobs.created_by_email`, set by a database trigger (not spoofable, survives user deletion).
- UI pattern for changes: edits and destructive actions use a confirmation step and a success toast (`toast.success` from sonner); errors are shown inside the dialog.
- Database changes are **always** new migration files in `supabase/migrations/`; never edit an applied migration.
- Small, focused commits using Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Reference GitHub issues in commits: `feat: kanban filters (closes #20)`.

## Work plan (GitHub milestones and issues)

Issues and milestones live on GitHub: https://github.com/saharrshirazii/MiniATS/milestones
Before starting a task, read the issue (`gh issue view <n>`) and follow its checklist and acceptance criteria.

| Milestone | Due | Issues |
|---|---|---|
| M0 · Setup | Mon 12 | #1–#6 |
| M1 · Auth & Accounts | Tue 13 | #7–#11 |
| M2 · Jobs | Tue 13 | #12–#14 |
| M3 · Candidates | Wed 14 | #15–#17 |
| M4 · Kanban | Wed 14 | #18–#20 |
| M5 · First Delivery | Wed 14 | #21–#23 |
| M6 · AI CV Assessment | Thu 15 | #24–#26 |
| M7 · Nice-to-haves | Thu 15 | #27–#29 |
| M8 · Final Delivery | Fri 16 | #30–#32 |

**Priority:** required features first. If time runs short: drop organizations → single-user customers; drop drag and drop → stage dropdown; drop AI implementation → explain approach in demo. Never cut RLS, the admin-only edge function, or the live deployment.

## AI CV assessment (plan)

Edge Function `assess-cv`: download CV from Storage → extract text → send CV text + job description to an LLM → require JSON output `{ score: 0-100, strengths: string[], gaps: string[], summary: string }` → save to `applications.ai_score` / `ai_summary`. The AI only assists; a human makes the decision.
