# MiniATS

A mini **Applicant Tracking System** built to get into the hands of a first customer as quickly as possible.
Recruiting teams post jobs, add candidates and move them through a hiring pipeline on a compact Kanban board.

| | |
|---|---|
| 🔗 **Live app** | [mini-ats-three.vercel.app](https://mini-ats-three.vercel.app) |
| 🎥 **Demo video** | _coming soon_ |
| 📋 **Roadmap** | [GitHub milestones](https://github.com/saharrshirazii/MiniATS/milestones) |

---

## Features

### Core
- [x] **Admin** creates accounts (admin and customer)
- [x] **Customer** logs in
- [x] **Customer** posts jobs they are recruiting for
- [x] **Customer** adds candidates with profile info (LinkedIn, email), with CV auto-fill
- [x] **Customer** sees a compact Kanban of all candidates linked to their jobs
- [x] **Customer** filters the Kanban by job and candidate name
- [x] **Admin** can do everything a customer can, on the customer's behalf (via the "Acting as" organization selector)

### Extra
- [x] CV upload to private Storage, signed-URL viewing, and a candidate detail panel (contact info, CV, LinkedIn, every job they're linked to, notes — editable in place)
- [x] "Talent pool" view: candidates not yet linked to a job, filterable from both the Candidates page and the Dashboard
- [x] Activity log: every job/candidate change recorded by database triggers (append-only); admins see all organizations, customers see their own, with search, filters and paging
- [x] Job lifecycle (draft, open, on hold, closed, archived) and soft delete with 90-day restore
- [ ] AI-based CV assessment (score, strengths, gaps, summary) — see [AI CV assessment](#ai-cv-assessment) below

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Data fetching | TanStack Query, supabase-js |
| Forms & validation | react-hook-form, zod |
| Drag and drop | dnd-kit |
| Backend | Supabase (Auth, PostgreSQL, Row Level Security, Storage, Edge Functions) |
| Hosting | Vercel |

---

## Architecture

```
┌──────────────────────┐        ┌───────────────────────────────────────┐
│  React app (Vercel)  │        │               Supabase                │
│                      │  anon  │                                       │
│  • Login             │  key + │  Auth ──────── users & sessions       │
│  • Jobs              │  JWT   │  PostgreSQL ── data, protected by RLS │
│  • Candidates        │ ─────► │  Storage ───── CVs (private bucket)   │
│  • Kanban            │        │  Edge Functions                       │
│  • Admin             │        │    • create-user, delete-user         │
└──────────────────────┘        │    • parse-cv    (admin / CV parsing) │
                                │    • assess-cv   (planned — see below)│
                                └───────────────────────────────────────┘
```

### Data model

| Table | Purpose |
|---|---|
| `organizations` | A customer company |
| `profiles` | User role (`admin` / `customer`) and organization |
| `jobs` | Jobs an organization is recruiting for |
| `candidates` | Candidate profiles (name, email, LinkedIn, CV) |
| `applications` | Links a candidate to a job with a pipeline stage. **Each Kanban card is one application** |

Pipeline stages: `applied → screening → interview → offer → hired / rejected`

### Security
- **Row Level Security** on every table: customers only see their own organization's data; admins see everything.
- **No public sign-up.** Accounts are created by admins through the `create-user` Edge Function.
- The Supabase `service_role` key is only used server-side in Edge Functions, never in the browser.

---

## Getting started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project
- The Supabase CLI is installed as a dev dependency, so run it with `npx supabase …`

### 1. Clone and install
```bash
git clone https://github.com/saharrshirazii/MiniATS.git
cd MiniATS
npm install
```

### 2. Environment variables
```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |

### 3. Database
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push      # apply migrations in supabase/migrations
npm run db:types     # regenerate src/types/database.types.ts
```

### 4. Edge Functions
```bash
npx supabase functions deploy create-user
npx supabase functions deploy delete-user
npx supabase functions deploy parse-cv
```

| Function | Purpose |
|---|---|
| `create-user` | Admin-only. Verifies the caller is an admin, then creates the account and its profile (role, organization). |
| `delete-user` | Admin-only. Deletes an account (not your own). The database keeps at least one admin. |
| `parse-cv` | Any signed-in user. Reads an uploaded CV (PDF) and returns contact details to pre-fill the candidate form. Touches no data. |

`assess-cv` (AI CV assessment) is planned but not yet deployed — see [AI CV assessment](#ai-cv-assessment) below.

Tests (requires [Deno](https://deno.com)):
```bash
deno test supabase/functions/
```

### 5. Run locally
```bash
npm run dev
```

### 6. Create the first admin
1. Supabase → **Authentication → Users → Add user**, tick **Auto Confirm User**.
2. Supabase → **SQL Editor** → run [`supabase/scripts/promote-admin.sql`](supabase/scripts/promote-admin.sql) with your email:
   ```sql
   update public.profiles set role = 'admin', organization_id = null where email = 'you@example.com';
   ```
3. Sign in to the app. From now on, create all other accounts under **Admin → Users**.

### Useful scripts
| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Apply database migrations |
| `npm run db:types` | Regenerate TypeScript types from the database |

---

## Project structure

```
├── supabase/
│   ├── migrations/      # Database schema and RLS policies
│   ├── functions/       # Edge Functions (create-user, delete-user, parse-cv)
│   └── seed.sql         # Demo data
└── src/
    ├── components/      # UI, layout and Kanban components
    ├── contexts/        # Auth and "acting as organization" context
    ├── hooks/           # Data hooks (jobs, candidates, applications)
    ├── lib/             # Supabase client and utilities
    ├── pages/           # Route pages (incl. admin pages)
    └── types/           # Generated database types
```

---

## Assumptions

**Core**
- A **customer is an organization** (company) that can have several users.
- **Only admins create accounts**; there is no public sign-up.
- Admins act on a customer's behalf by **selecting the organization** in the app, not by impersonating a user — all queries run as the admin (RLS grants admins full access), scoped to the chosen org.
- One candidate can apply to **several jobs**; each application (not each candidate) is one Kanban card.
- Pipeline stages are **fixed** for every organization: `applied → screening → interview → offer → hired | rejected`.

**Made along the way**
- A job's lifecycle is **draft → open ⇄ on hold → closed → archived**. Only a title is required for a draft; publishing requires a work-place type (on-site/hybrid/remote). Closed and archived jobs are read-only; deleting an open/on-hold job soft-deletes it (restorable by an admin for 90 days) rather than removing it outright, since it may already have candidates in its pipeline.
- A candidate with **no job attached** is a "talent pool" candidate — useful for people worth keeping on file before there's an open role for them. Both the Candidates page and the Dashboard can filter to just the talent pool.
- **LinkedIn profiles can't be scraped**, so candidate enrichment (pre-filling the form from a CV) is CV-based, not LinkedIn-based.
- CVs are stored as PDFs in a **private** Storage bucket and viewed through short-lived signed URLs — never a permanent public link.
- The **activity log** records creation, edits (full name, email, phone, LinkedIn, notes) and deletion for candidates, and creation, edits, status changes, soft delete/restore and permanent deletion for jobs — the fuller lifecycle jobs have.
- The admin-only **account creation** and **CV-assessment** server logic run in Supabase Edge Functions using the `service_role` key, which never reaches the browser; every function re-checks the caller's role server-side rather than trusting the client.

---

## AI CV assessment

Planned, not yet built (explained in the demo video in the meantime). The approach:

1. A new `assess-cv` Edge Function, called from the candidate detail panel ("Assess fit for this job").
2. It downloads the candidate's CV from the private `cvs` bucket and extracts the text (same PDF-parsing approach as the existing `parse-cv` function).
3. It sends the CV text plus the target job's title/description to an LLM, asking for strict JSON:
   `{ score: 0-100, strengths: string[], gaps: string[], summary: string }`.
4. The result is saved on the `applications` row (`ai_score`, `ai_summary` — already in the schema) and shown on the card/detail panel.
5. **The AI only assists.** It's a second opinion for a human reviewer to accept, ignore, or disagree with — it never moves a card or rejects a candidate on its own.

---

## Built with AI tools

This project was built with AI-assisted development, as encouraged by the assignment:

- **Claude** – planning, architecture and task breakdown
- **Claude Code** – implementation in VS Code

---

## Author

**Sahar** – [GitHub](https://github.com/saharrshirazii)
