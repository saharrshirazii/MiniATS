# MiniATS

A mini **Applicant Tracking System** built to get into the hands of a first customer as quickly as possible.
Recruiting teams post jobs, add candidates and move them through a hiring pipeline on a compact Kanban board.

| | |
|---|---|
| 🔗 **Live app** | [mini-ats-three.vercel.app](https://mini-ats-three.vercel.app) |
| 🎥 **Demo video** | [Loom walkthrough](https://www.loom.com/share/9ac404fedd0e40e588ebb1c9b217f6ed) |
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
- [x] AI-based CV assessment (score, strengths, gaps, summary) — see [AI CV assessment](#ai-cv-assessment) below
- [x] Responsive layout: a slide-out mobile navigation menu below the `md` breakpoint, scrollable tables/Kanban columns on narrow screens, and dialogs capped to the viewport height so forms don't clip on mobile

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
└──────────────────────┘        │    • parse-cv    (CV → contact fields)│
                                │    • assess-cv   (CV → AI fit score)  │
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
- The Supabase `service_role` key is only used server-side, and only by `create-user`/`delete-user` (account management needs it to bypass RLS). `parse-cv` and `assess-cv` instead run as the caller — built from their own JWT — so the same RLS rules that protect a browser query protect these too; a customer can only assess their own organization's candidates.

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
npx supabase functions deploy assess-cv
```

`assess-cv` also needs an LLM API key as a secret (never committed, never `VITE_`-prefixed):
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

| Function | Purpose |
|---|---|
| `create-user` | Admin-only. Verifies the caller is an admin, then creates the account and its profile (role, organization). |
| `delete-user` | Admin-only. Deletes an account (not your own). The database keeps at least one admin. |
| `parse-cv` | Any signed-in user. Reads an uploaded CV (PDF) and returns contact details to pre-fill the candidate form. Touches no data. |
| `assess-cv` | Any signed-in user with access to the application. Reads a candidate's CV, sends it with the job to an LLM, and saves the fit score/summary — see [AI CV assessment](#ai-cv-assessment) below. |

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
│   ├── functions/       # Edge Functions (create-user, delete-user, parse-cv, assess-cv)
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
- The **activity log** records creation, edits (full name, email, phone, LinkedIn, notes) and deletion for candidates, and creation, edits, status changes, soft delete/restore and permanent deletion for jobs — the fuller lifecycle jobs have. An AI assessment does **not** add a log entry — it's advisory data on the application, not a pipeline action.
- The admin-only **account creation** runs in an Edge Function using the `service_role` key, which never reaches the browser. `parse-cv` and `assess-cv` don't need that privilege: they run as the caller's own JWT, so RLS does the scoping for free and there's no custom role check to get wrong.

---

## AI CV assessment

### Approach

1. The candidate detail panel has an **"Assess with AI"** button on each job in their pipeline (one assessment per *application*, i.e. per candidate–job pair — the same CV can score differently against different jobs).
2. The `assess-cv` Edge Function downloads the candidate's CV from the private `cvs` bucket and extracts its text (same PDF-parsing approach as `parse-cv`: [`unpdf`](https://github.com/unjs/unpdf), shared via `supabase/functions/_shared/pdf.ts`).
3. It sends the CV text plus the job's title/description to an LLM ([Claude Haiku](https://docs.claude.com/en/docs/about-claude/models/overview) — fast and inexpensive, which fits a classification/extraction task like this), asking for **strict JSON only**:
   ```json
   { "score": 0-100, "strengths": ["..."], "gaps": ["..."], "summary": "..." }
   ```
   The response is parsed and validated against that exact shape (zod) before anything is saved — a malformed or off-schema reply fails the request rather than silently saving garbage.
4. The result is saved on the `applications` row (`ai_score`, `ai_summary`, `ai_strengths`, `ai_gaps`, `ai_assessed_at`) and shown on the Kanban card (a small colored score badge) and in the candidate detail panel (score, summary, strengths, gaps).
5. The function runs as the **caller's own JWT**, not `service_role` — RLS does the organization scoping, exactly as it would for a query from the browser. No separate role check was needed.

### Prompt design

The prompt is deliberately narrow: compare *this* CV against *this* job and return only the four fields above, nothing else. It explicitly asks for concrete, CV-grounded strengths and gaps ("reference actual details... not generic praise") rather than generic encouragement, and reminds the model that a human makes the final call, which nudges it to actually name gaps instead of smoothing them over. CV text and job description are both truncated to a few thousand characters before the call, which keeps cost and latency predictable and is enough for a CV/job-description-length document. Extended thinking is explicitly disabled on the request (`thinking: { type: "disabled" }`) — this is a short classification task with no need for a visible reasoning trace, and it keeps the response to a single, predictable JSON text block.

### Limitations

- **The AI only assists.** A score, summary, strengths and gaps are *information for a human reviewer* — the function never moves a Kanban card, changes a stage, or rejects a candidate on its own. There's also no activity-log entry for an assessment; it isn't a pipeline action.
- **Bias.** An LLM trained on real-world text can reproduce real-world hiring bias — e.g. favoring certain schools, employers, or phrasing styles over substance. The score is a starting point for a conversation, not a ranking to sort candidates by and trust blindly.
- **Hallucination.** The model can occasionally invent a plausible-sounding "strength" or "gap" that isn't actually supported by the CV text, especially on a short or unusually formatted CV. The output is validated for *shape* (strict JSON schema), not for *factual accuracy* against the source document — a reviewer should still skim the actual CV.
- **CV quality in, assessment quality out.** A scanned-image PDF with no extractable text, a CV in a language the parser mishandles, or a very unconventional layout will all produce a weaker assessment (or an outright 422 error if no text could be extracted at all).
- **GDPR / data handling.** The CV's full text (personal data) is sent to a third-party LLM API for this one request; it is not stored by MiniATS beyond the four summary fields above (no raw CV text is persisted outside the original PDF in Storage), and the provider call carries no identifying fields beyond what's in the CV text itself. For a production deployment this would need a documented sub-processor, a retention/training-opt-out check with the LLM provider, and ideally a candidate-facing notice that an AI assessment can be requested on their application.

---

## Built with AI tools

This project was built with AI-assisted development, as encouraged by the assignment:

- **Claude** – planning, architecture and task breakdown
- **Claude Code** – implementation in VS Code

---

## Author

**Sahar** – [GitHub](https://github.com/saharrshirazii)
