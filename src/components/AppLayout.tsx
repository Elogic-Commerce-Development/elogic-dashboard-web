import { useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { defaultFilters, type Filters } from '@/lib/filters'
import { FilterContext } from '@/lib/FilterContext'
import { FilterBar } from './FilterBar'
import { SyncStatusBadge } from './SyncStatusBadge'
import { TrackingSinceBanner } from './TrackingSinceBanner'

/**
 * §3's target IA, complete as of F7: Radar, Estimation, Quality, Write-offs,
 * People, Projects — in the plan's own order, which runs roughly from daily
 * glance to monthly review. The legacy Dashboard is gone; it was the last page
 * outside the target IA and the last consumer of the pre-redesign
 * `v_dashboard_*` views.
 */
const navItems = [
  { to: '/radar' as const, label: 'Radar' },
  { to: '/estimation' as const, label: 'Estimation' },
  { to: '/quality' as const, label: 'Quality' },
  { to: '/write-offs' as const, label: 'Write-offs' },
  { to: '/people' as const, label: 'People' },
  { to: '/projects' as const, label: 'Projects' },
]

export function AppLayout() {
  // Entity filters only. The period lives in each page's URL and is selected
  // through <PeriodSwitcher> — see lib/period + lib/useListFilters.
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  // Radar answers "what needs attention now" over fixed signal windows, and
  // Estimation declares its own scope (fixed-scope + maintenance) as the point
  // of the page — neither takes the entity filters.
  const isRadar = pathname === '/' || pathname === '/radar'
  const isEstimation = pathname === '/estimation'
  // F7's two pages likewise declare their own scope in words at the top and in
  // the footer. Write-offs in particular is *company-wide* by definition (§5
  // pins 8.8% against the whole company and splits it in/out of scope on the
  // page itself), so a project multi-select would silently redefine the metric
  // rather than filter it.
  const isQuality = pathname === '/quality'
  const isWriteOffs = pathname === '/write-offs'
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
    isEstimation ||
    isQuality ||
    isWriteOffs ||
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
