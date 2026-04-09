# elogic-dashboard-web

React + TypeScript + Vite SPA that reads Supabase Postgres metric views via
PostgREST. Authenticates against Supabase Auth (single shared user). Hosted on
Vercel free tier.

This repo is the **dashboard UI only**. It never talks to the Laravel
backend ([elogic-dashboard-backend](../elogic-dashboard-backend)) — both
projects deploy independently and communicate exclusively through the
Supabase database schema.

## Quickstart (local dev)

```bash
git clone <this repo>
cd elogic-dashboard-web
cp .env.example .env.local
# edit .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev                 # Vite dev server on http://localhost:5173
```

Sign in with the shared dashboard credentials (Supabase Auth user, created
manually via the Supabase dashboard).

## Environment variables

| Var | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → Project API keys → `anon` `public` |

The anon key is safe to embed in the bundle — Row Level Security on the
underlying tables is the actual security boundary.

**Never** put the `service_role` key here. It would bypass RLS and is
service-only.

## Build & deploy (Vercel)

```bash
npm run build               # tsc -b && vite build → dist/
```

Vercel deploys automatically from the linked GitHub repo:

1. Vercel dashboard → New Project → Import this repo
2. Framework preset: **Vite**
3. Build command: `npm run build` (default)
4. Output directory: `dist` (default)
5. Environment Variables → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
6. Deploy

After deploy, every `git push` to `main` ships a new production build.

## Architecture

```
src/
├── main.tsx                       # AuthGate: LoginForm vs AppShell
├── index.css                      # Tailwind v4 entry
├── lib/
│   ├── supabase.ts                # Supabase client singleton
│   ├── filters.ts                 # Zod schema for global filters
│   ├── format.ts                  # Hours / ratios / dates
│   └── queries.ts                 # Typed fetchers per metric view
└── components/
    ├── LoginForm.tsx
    ├── AppShell.tsx               # Header, tabs, layout
    ├── FilterBar.tsx              # Date range + project + user filters
    ├── DataTable.tsx              # TanStack Table wrapper
    ├── SyncStatusBadge.tsx        # Reads v_sync_status
    ├── TrackingSinceBanner.tsx    # "Tracking from 2025-01-01" honesty banner
    └── metrics/                   # One component per metric view
        ├── TasksWithoutEstimatesTable.tsx
        ├── OverrunTable.tsx
        ├── EstimateVsActualTable.tsx
        ├── AccuracyByUserTable.tsx
        └── AccuracyByProjectTable.tsx
```

The dashboard has three tabs:

| Tab | Tables |
|---|---|
| **Overview** | Tasks without estimates, Tasks overrun |
| **Estimates** | Estimate vs actual (the flagship view) |
| **People** | Accuracy by user, Accuracy by project |

All tables consume the same global `Filters` (date range + project +
assignee multi-select) wired through `FilterBar`.

## Adding a new metric

1. **Backend repo**: write a new Laravel migration that creates the view
2. **Backend repo**: `php artisan migrate` against Supabase
3. **This repo**: add a typed fetcher in `src/lib/queries.ts`
4. **This repo**: build a `<NewMetricTable>` component in
   `src/components/metrics/`
5. **This repo**: render it inside the relevant tab in `AppShell.tsx`
6. Commit, push — Vercel auto-deploys

No infrastructure changes, no schema regeneration, no API endpoint. The
entire data path is `Postgres view → PostgREST → supabase-js → React`.

## Tech stack

- **Vite + React 19 + TypeScript** — build, framework, types
- **Tailwind CSS v4** — utility styling
- **TanStack Table v8** — headless table primitives
- **Zod** — filter schema validation
- **@supabase/supabase-js** — auth + PostgREST client

## Documentation

- [Backend repo](../elogic-dashboard-backend) — sync, schema, runbook
- [Backend `docs/METRICS.md`](../elogic-dashboard-backend/docs/METRICS.md) — definitive metric definitions
- [Backend `docs/RUNBOOK.md`](../elogic-dashboard-backend/docs/RUNBOOK.md) — operator runbook
- [Backend `docs/SHARED_INFRA.md`](../elogic-dashboard-backend/docs/SHARED_INFRA.md) — Supabase project + schema-change workflow
