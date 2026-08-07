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
 * glance to monthly review.
 *
 * Dashboard sits last and outside that order. F7 deleted it and the owner
 * reversed that (2026-08-07): it stays as a rolled-up overview, and it is what
 * the header logo now points at. It is listed here as well as being the logo's
 * destination so there is still a way back to it once you have navigated away —
 * a logo-only entrance is a page you can leave but not return to.
 */
const navItems = [
  { to: '/radar' as const, label: 'Radar' },
  { to: '/estimation' as const, label: 'Estimation' },
  { to: '/quality' as const, label: 'Quality' },
  { to: '/write-offs' as const, label: 'Write-offs' },
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
  const isRadar = pathname === '/' || pathname === '/radar'

  /**
   * The FilterBar is an **allowlist**, and that inversion is the fix for a real
   * defect: it used to be an opt-OUT list, so any path not named in it rendered
   * the bar — including every unmatched URL. F7's deployed pass found the
   * retired `/dashboard` serving a project multi-select floating above an empty
   * page. Opt-out means "new surfaces get the FilterBar by accident"; opt-in
   * means a page has to ask.
   *
   * Only `/projects` asks. Every other surface declares its own scope: Radar
   * over fixed signal windows, Estimation over the estimating segments, Quality
   * and Write-offs in words at the top and in the footer (Write-offs is
   * *company-wide* by definition — §5 pins 8.8% against the whole company — so a
   * project filter would silently redefine the metric rather than filter it),
   * /people over §4.5's roster, /dashboard over its own period switcher, and the
   * three detail pages over one entity each.
   */
  const isProjectsList = pathname === '/projects'
  const hideFilterBar = !isProjectsList

  return (
    <FilterContext value={{ filters, setFilters }}>
      <div className="min-h-screen bg-neutral-50">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              {/*
                The wordmark goes to /dashboard, on the owner's call
                (2026-08-07). Note this is deliberately NOT the same as `/`,
                which still redirects to Radar per §3 — typing the bare domain
                lands on the triage page, clicking the wordmark lands on the
                rolled-up overview.
              */}
              <Link to="/dashboard" className="text-lg font-semibold text-neutral-900">
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
