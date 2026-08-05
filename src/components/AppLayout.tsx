import { useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { defaultFilters, type Filters } from '@/lib/filters'
import { FilterContext } from '@/lib/FilterContext'
import { FilterBar } from './FilterBar'
import { SyncStatusBadge } from './SyncStatusBadge'
import { TrackingSinceBanner } from './TrackingSinceBanner'

/**
 * §3's target order — Radar, Estimation, People, Projects (Quality and
 * Write-offs join at F7). The legacy Dashboard sits last because it is the one
 * page not in the target IA; §4.1 hands its KPI cards to Radar and its
 * adoption/accuracy charts to Estimation, so it is a leftover, not a section.
 */
const navItems = [
  { to: '/radar' as const, label: 'Radar' },
  { to: '/estimation' as const, label: 'Estimation' },
  { to: '/people' as const, label: 'People' },
  { to: '/projects' as const, label: 'Projects' },
  { to: '/dashboard' as const, label: 'Dashboard' },
]

export function AppLayout() {
  // Entity filters only. The period lives in each page's URL and is selected
  // through <PeriodSwitcher> — see lib/period + lib/useListFilters.
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  // Radar answers "what needs attention now" over fixed signal windows, the
  // Dashboard aggregates its own scope, and Estimation declares its own scope
  // (fixed-scope + maintenance) as the point of the page — none of the three
  // takes the entity filters.
  const isRadar = pathname === '/' || pathname === '/radar'
  const isDashboard = pathname === '/dashboard'
  const isEstimation = pathname === '/estimation'
  // F5: /people declares its own population — §4.5's active roster, grouped by
  // department — the way Radar and Estimation declare theirs. A user
  // multi-select over a page of coaching cards would let someone quietly
  // narrow the roster to one colleague, which is the opposite of what a
  // no-ranking page is for, so it goes.
  const isPeopleList = pathname === '/people'
  // /people/<id>, /projects/<id> and /tasks/<id> are all scoped to a single
  // entity, so the global project + user multi-select adds no value there.
  const isContributorDetail = /^\/people\/[^/]+/.test(pathname)
  const isProjectDetail = /^\/projects\/[^/]+/.test(pathname)
  const isTaskDetail = /^\/tasks\/[^/]+/.test(pathname)
  const hideFilterBar =
    isRadar ||
    isDashboard ||
    isEstimation ||
    isPeopleList ||
    isContributorDetail ||
    isProjectDetail ||
    isTaskDetail
  // /projects is the one list grid still taking an entity filter.
  const isProjectsList = pathname === '/projects'

  return (
    <FilterContext value={{ filters, setFilters }}>
      <div className="min-h-screen bg-neutral-50">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-lg font-semibold text-neutral-900">
                Elogic Dashboard
              </Link>
              <nav className="flex gap-1">
                {navItems.map((item) => {
                  // `/` redirects to /radar, so the index path highlights Radar
                  // during the hop rather than leaving the nav blank.
                  const active =
                    item.to === '/radar' ? isRadar : pathname.startsWith(item.to)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <SyncStatusBadge />
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-5 px-6 py-6">
          <TrackingSinceBanner />
          {!hideFilterBar && (
            <FilterBar value={filters} onChange={setFilters} hideUsers={isProjectsList} />
          )}
          <Outlet />
        </main>
      </div>
    </FilterContext>
  )
}
