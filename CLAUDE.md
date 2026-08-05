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

Routing is `@tanstack/react-router` — `src/router.tsx` holds the route tree,
`components/AppLayout.tsx` is the root-route shell (header, nav, FilterBar,
`<Outlet/>`). The old tab-state `AppShell.tsx` was deleted in F1.

## Directory map

```
src/
├── main.tsx                     ← entrypoint + <AuthGate>
├── router.tsx                   ← route tree + the shared period search contract
├── index.css                    ← @import 'tailwindcss' + base body styles
├── lib/
│   ├── supabase.ts              ← singleton supabase client
│   ├── queries.ts               ← typed fetchers for every view
│   ├── period.ts                ← THE period model: presets, ranges, groups, URL parsing
│   ├── periodStats.ts           ← client-side period re-aggregation (F2 deletes this)
│   ├── useListFilters.ts        ← list grids: FilterBar entities + URL period → Filters
│   ├── filters.ts               ← Zod schema + defaultFilters + Filters type
│   ├── FilterContext.ts         ← entity-filter context (projects/users)
│   ├── utilization.ts           ← v_employee_day → utilization buckets
│   └── format.ts                ← formatHours, formatRatio, formatDate, externalTaskLink…
├── pages/                       ← one component per route
└── components/
    ├── AppLayout.tsx            ← root-route shell (header, nav, FilterBar, Outlet)
    ├── LoginForm.tsx            ← email/password via supabase.auth.signInWithPassword
    ├── PeriodSwitcher.tsx       ← THE period switcher, used by every surface
    ├── FilterBar.tsx            ← multi-select projects/users + Clear (no dates)
    ├── TrackingSinceBanner.tsx  ← amber banner noting 2025-01-01 cutoff
    ├── SyncStatusBadge.tsx      ← reads v_sync_status, colored dot
    ├── DataTable.tsx            ← generic TanStack Table wrapper
    └── metrics/
        ├── TasksWithoutEstimatesTable.tsx
        ├── OverrunTable.tsx
        ├── EstimateVsActualTable.tsx
        └── AccuracyByProjectTable.tsx
```

## Data flow

```
AppLayout
  ├── holds the entity Filters (projectIds / userIds) and renders <FilterBar>
  └── <Outlet/> → page
       ├── reads its period from the URL (?period=…&from=…&to=…)
       ├── list pages: useListFilters() merges period + entities into Filters
       └── passes Filters down to each metrics/*Table
            └── Table calls src/lib/queries.ts → Supabase view → DataTable
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
4. Render the new table from the relevant page in `src/pages/` (and add the
   route in `src/router.tsx` if it needs one).

## Gotchas

- **Tailwind v4 has no config file** — everything is driven by `@import
  'tailwindcss'` in `index.css` + the `@tailwindcss/vite` plugin. Do not
  add a `tailwind.config.js` unless you've read the v4 migration notes.
- **Path alias is in three places** — `tsconfig.app.json` (`baseUrl` +
  `paths`), `vite.config.ts` (`resolve.alias`), and the imports themselves.
  All three must agree.
- **AuthGate in `components/AuthGate.tsx`** (rendered by `main.tsx`):
  `supabase.auth.getSession()` is async; `ready` state prevents the login
  form flashing for already-signed-in users. Don't remove the `ready` gate.
- **`v_task_actual_vs_estimate` filter:** always filter to
  `estimate_hours IS NOT NULL` in the fetcher, otherwise the Estimate vs
  Actual table shows rows with no estimate.
- **Sign out:** `supabase.auth.signOut()` — the `onAuthStateChange` listener
  in AuthGate handles the re-render automatically.
- **Recharts 3 Pie sectors:** put the per-slice `fill` on each data item, NOT
  inside `<Cell>` children. The `<Cell>` pattern made the chart compute
  angles from the cells (rendering as a tiny ~28° wedge) instead of from
  the data values. Also set `startAngle={90} endAngle={-270}` explicitly
  for a top-starting clockwise donut. See [UtilizationDonut.tsx](src/components/UtilizationDonut.tsx).
- **One period model, one switcher.** `src/lib/period.ts` owns the whole
  vocabulary; `PERIOD_GROUPS` says which presets each surface offers and what
  its default is; `<PeriodSwitcher group={…}>` is the only control. Adding a
  preset means adding it to `PeriodPreset` + `PERIOD_LABELS` + `periodRange()`
  and to whichever group should show it — never a second module.
- **Period state lives in URL search params** via TanStack Router's
  `validateSearch` (`periodSearchValidator` in `router.tsx`). All search fields
  are optional so existing `<Link to="/people/$userId">` call sites without
  `search` still type-check. Defaults are resolved in the page component, not
  the router, and `periodSearchParams()` omits the preset when it equals the
  page default so a page at its default has a clean URL.
- **`all_time` means "no date filter", not "since the tracking floor".**
  `periodFilterRange()` returns `{from: undefined, to: undefined}` for it,
  because `PeoplePage`/`ProjectsPage` switch between the server view and the
  client period pipeline on `Boolean(from || to)`, and `fetchAccuracyByProject`
  switches branches the same way. Resolving it to `2025-01-01` would silently
  re-route those pages onto the period pipeline and move their numbers.
- **`?period=` supersedes `?preset=`, and `3m/6m/12m/ytd/all` are legacy
  aliases.** `parsePeriodSearch()` still accepts both so pre-F1 bookmarks
  resolve to the period they always meant. Safe to drop once nobody's
  bookmarks matter.

## Browser verification via Chrome MCP

**Claude has no working `.env.local`.** Supabase credentials are
operator-owned, so `npm run dev` won't connect to anything useful on
Claude's machine. Local verification is limited to:

```bash
npm run lint     # eslint
npm run build    # tsc + vite build
```

Do not propose a local smoke-test step in plans — the operator has stated
this directly. The bundle reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` at build time from `.env.local`, which only
exists on the operator's machine. The established way to verify a UI
change end-to-end against real data is:

1. `git switch main && git pull` so the feature branch comes off clean main.
2. Create the feature branch, make changes, run `npm run lint && npm run build`.
3. Push the branch and reply with a **pre-filled compare URL** —
   `https://github.com/Elogic-Commerce-Development/elogic-dashboard-web/compare/main...<branch>?quick_pull=1&title=…&body=…`.
   There is **no `gh` CLI and no GitHub token on this machine**, so
   `gh pr create` exits 127; don't use it.
4. Operator merges the PR (or asks for a Vercel preview deployment).
5. Operator types something like "deployed" in chat once Vercel is done.
6. Claude uses the **Chrome MCP** (tools named `mcp__claude-in-chrome__*`)
   against the production URL `https://elogic-dashboard-web.vercel.app`.

**Vercel deploys from `main` only** — Claude cannot trigger a deploy, and there
is no preview URL unless the operator asks Vercel for one. So a change can only
be verified against real data *after* the operator merges. When a change must be
proven not to move any number, **capture the baseline from the deployed page
before writing any code** — that is the only pre-change snapshot available.

This works because the operator's existing Chrome session is already
authenticated against Supabase — the MCP tab shares cookies with the
operator's other tabs, so no login dance is needed.

Useful patterns:

```text
1. tabs_context_mcp { createIfEmpty: true } → returns the new MCP tab id
2. navigate { tabId, url: 'https://elogic-dashboard-web.vercel.app/<route>' }
3. computer { action: 'wait', duration: 2, tabId }   // give React + supabase fetch a beat
4. computer { action: 'screenshot', tabId }          // visual check
5. computer { action: 'zoom', region: [x0,y0,x1,y1], tabId }   // inspect a small region
6. javascript_tool { ..., text: '<expression>' }     // inspect React fiber, DOM, dimensions
   — note: this tool does NOT await Promises; use IIFEs that finish synchronously
     OR use postMessage / globals to capture async results across calls
7. read_console_messages { tabId, pattern: 'error|warn' }
8. read_network_requests { tabId, urlPattern: 'supabase.co/rest' }
9. computer { action: 'left_click', coordinate, tabId }   // exercise the UI
10. computer { action: 'screenshot', tabId }              // confirm reflow
```

When the production URL doesn't update after a merge, give Vercel ~30s and
re-navigate (Chrome cache rarely interferes since Vercel serves a fresh
hashed bundle).

For diagnosing a broken chart, walk the React fiber tree to find the
component's `memoizedProps`:

```js
const el = document.querySelector('.recharts-pie')
const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'))
let f = el[fiberKey]
while (f) {
  if (f.type?.displayName === 'Pie' || f.type?.name === 'Pie') {
    console.log(f.memoizedProps)
    break
  }
  f = f.return
}
```

This is how the `<Cell>` vs `data.fill` Recharts bug was diagnosed without
having to redeploy a debug build.

**Do not** use the `mcp__Claude_Preview__*` tools for this project — there
is no local preview server wired up to Supabase. Use Chrome MCP against the
deployed URL instead.
