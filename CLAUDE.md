# elogic-dashboard-web — Claude working notes

Vite + React 19 + TypeScript SPA. Reads Supabase Postgres metric views via
PostgREST, authenticates against Supabase Auth with a single shared login.
Deployed to Vercel (free tier).

> The workspace root `CLAUDE.md` (`../CLAUDE.md`) has the project overview,
> current state, and "what's pending" list. Read it first.

## Stack

- Vite 8, React 19, TypeScript 6
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- TanStack Table v8 (headless) for all metric tables
- `@supabase/supabase-js` for data + auth
- Zod for the filter schema
- `@/` path alias via tsconfig `baseUrl` + `paths` + matching Vite `resolve.alias`

**No router library in MVP** — AppShell holds a `tab` state and switches
between overview / estimates / people. If deeplinks are needed, add
`@tanstack/react-router` (already in `package.json`).

## Directory map

```
src/
├── main.tsx                     ← entrypoint + <AuthGate>
├── index.css                    ← @import 'tailwindcss' + base body styles
├── lib/
│   ├── supabase.ts              ← singleton supabase client
│   ├── queries.ts               ← typed fetchers for every view
│   ├── filters.ts               ← Zod schema + defaultFilters + Filters type
│   └── format.ts                ← formatHours, formatRatio, formatDate, formatDateTime
└── components/
    ├── AppShell.tsx             ← top-level layout (header, tabs, FilterBar, tab content)
    ├── LoginForm.tsx            ← email/password via supabase.auth.signInWithPassword
    ├── FilterBar.tsx            ← date range + multi-select projects/users + Clear
    ├── TrackingSinceBanner.tsx  ← amber banner noting 2025-01-01 cutoff
    ├── SyncStatusBadge.tsx      ← reads v_sync_status, colored dot
    ├── DataTable.tsx            ← generic TanStack Table wrapper
    └── metrics/
        ├── TasksWithoutEstimatesTable.tsx
        ├── OverrunTable.tsx
        ├── EstimateVsActualTable.tsx
        ├── AccuracyByUserTable.tsx
        └── AccuracyByProjectTable.tsx
```

## Data flow

```
AppShell
  ├── holds Filters state
  ├── passes to <FilterBar> (which updates filters)
  └── passes to each metrics/*Table component
       └── Table calls src/lib/queries.ts → Supabase view → renders via DataTable
```

All data fetching is **inside each table component** — no global
data layer. TanStack Query is NOT used; each table runs a `useEffect` on
mount + filter changes. For MVP this is fine. If re-fetches get noisy, move
to TanStack Query.

## Conventions

- **Path alias:** import from `@/lib/supabase`, `@/components/FilterBar`,
  etc. Never relative imports deeper than one level.
- **Filters type:** always go through `Filters` from `@/lib/filters`.
  `defaultFilters` is exported — use it for resets and initial state.
- **Query functions:** one function per view in `src/lib/queries.ts`. Each
  takes `Filters` and applies the filter chain inline (we had a generic
  `applyCommonFilters` helper but the TS was gnarly — inline is clearer).
- **Views, not tables:** every fetcher hits a `v_*` view, never a raw table,
  except `projects` and `users` (for FilterBar dropdowns) and
  `v_sync_status` (for SyncStatusBadge).
- **Colors:** plain Tailwind utilities, no shadcn/ui. Red for bad (ratio
  >= 2.0), amber for warning (ratio >= 1.5), emerald for good, neutral
  greys everywhere else.
- **Dates in filters:** stored as ISO date strings (`YYYY-MM-DD`), not
  Date objects. Pass straight through to Supabase filters.

## Env vars

```bash
# .env.local (not committed)
VITE_SUPABASE_URL=https://kplmevzhcwtzaiimhwbc.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key from supabase dashboard>
```

Anon key is safe to ship in the bundle — RLS is the security boundary. The
`supabase.ts` singleton throws on missing env vars so you can't accidentally
deploy without setting them.

## Common commands

```bash
npm install
npm run dev          # Vite dev server at :5173
npm run build        # tsc + vite build → dist/
npm run preview      # serve dist/ locally
npm run lint         # eslint
```

## Adding a new metric table

1. Add the view to the backend repo migration + document in
   `elogic-dashboard-backend/docs/METRICS.md`.
2. Add a typed row + fetcher in `src/lib/queries.ts`.
3. Create `src/components/metrics/<Name>Table.tsx` — copy the closest
   existing table as a starting point, define TanStack column defs, wire
   the fetcher in a `useEffect` keyed on filters.
4. Slot the new table into the appropriate tab in `AppShell.tsx`.

## Gotchas

- **Tailwind v4 has no config file** — everything is driven by `@import
  'tailwindcss'` in `index.css` + the `@tailwindcss/vite` plugin. Do not
  add a `tailwind.config.js` unless you've read the v4 migration notes.
- **Path alias is in three places** — `tsconfig.app.json` (`baseUrl` +
  `paths`), `vite.config.ts` (`resolve.alias`), and the imports themselves.
  All three must agree.
- **AuthGate in `main.tsx`**: `supabase.auth.getSession()` is async;
  `ready` state prevents the login form flashing for already-signed-in
  users. Don't remove the `ready` gate.
- **`v_task_actual_vs_estimate` filter:** always filter to
  `estimate_hours IS NOT NULL` in the fetcher, otherwise the Estimate vs
  Actual table shows rows with no estimate.
- **Sign out:** `supabase.auth.signOut()` — the `onAuthStateChange` listener
  in AuthGate handles the re-render automatically.
