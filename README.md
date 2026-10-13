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
- [ ] **Admin** creates accounts (admin and customer)
- [ ] **Customer** logs in
- [ ] **Customer** posts jobs they are recruiting for
- [ ] **Customer** adds candidates with profile info (LinkedIn, email, CV)
- [ ] **Customer** sees a compact Kanban of all candidates linked to their jobs
- [ ] **Customer** filters the Kanban by job and candidate name
- [ ] **Admin** can do everything a customer can, on the customer's behalf

### Extra
- [ ] AI-based CV assessment (score, strengths, gaps, summary)

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
│  • Admin             │        │    • create-user (admin only)         │
└──────────────────────┘        │    • assess-cv   (LLM call)           │
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
npx supabase functions deploy assess-cv
npx supabase secrets set LLM_API_KEY=<your-key>
```

### 5. Run locally
```bash
npm run dev
```

### 6. Create the first admin
1. Supabase → **Authentication → Users → Add user**, tick **Auto Confirm User**.
2. Supabase → **SQL Editor**:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

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
│   ├── functions/       # Edge Functions (create-user, assess-cv)
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

- A **customer is an organization** (company) that can have several users.
- **Only admins create accounts**; there is no public sign-up.
- Admins act on a customer's behalf by **selecting the organization** in the app, not by impersonating a user.
- One candidate can apply to **several jobs**; each application is tracked separately.
- Pipeline stages are **fixed** for all organizations.

---

## AI CV assessment

_Approach and implementation details coming soon._

---

## Built with AI tools

This project was built with AI-assisted development, as encouraged by the assignment:

- **Claude** – planning, architecture and task breakdown
- **Claude Code** – implementation in VS Code

---

## Author

**Sahar** – [GitHub](https://github.com/saharrshirazii)
