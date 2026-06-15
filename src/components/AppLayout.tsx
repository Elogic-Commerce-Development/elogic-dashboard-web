import { useEffect, useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { defaultFilters, type Filters } from '@/lib/filters'
import { FilterContext } from '@/lib/FilterContext'
import { fetchJiraProjectIds, fetchOutsourcingProjectIds } from '@/lib/queries'
import { FilterBar } from './FilterBar'
import { SyncStatusBadge } from './SyncStatusBadge'
import { TrackingSinceBanner } from './TrackingSinceBanner'

const navItems = [
  { to: '/' as const, label: 'Dashboard' },
  { to: '/overview' as const, label: 'Overview' },
  { to: '/estimates' as const, label: 'Estimates' },
  { to: '/people' as const, label: 'People' },
  { to: '/projects' as const, label: 'Projects' },
]

export function AppLayout() {
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  // Dashboard scope = AC "OUTSOURCING PROJECT" ids ∪ Jira (PSP) project ids.
  const [outsourcingProjectIds, setOutsourcingProjectIds] = useState<number[]>([])
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const isDashboard = pathname === '/'
  // /people, /projects, and the deep /tasks/<id> page are all scoped to a
  // single entity, so the global From/To + project + user multi-select adds
  // no value there. The list pages keep the FilterBar.
  const isContributorDetail = /^\/people\/[^/]+/.test(pathname)
  const isProjectDetail = /^\/projects\/[^/]+/.test(pathname)
  const isTaskDetail = /^\/tasks\/[^/]+/.test(pathname)
  const hideFilterBar = isDashboard || isContributorDetail || isProjectDetail || isTaskDetail
  // The list grids each get only their own entity filter + the date range:
  // /people filters by people, /projects by projects.
  const isPeopleList = pathname === '/people'
  const isProjectsList = pathname === '/projects'

  useEffect(() => {
    Promise.all([fetchOutsourcingProjectIds(), fetchJiraProjectIds()])
      .then(([ac, jira]) => setOutsourcingProjectIds([...new Set([...ac, ...jira])]))
      .catch(() => setOutsourcingProjectIds([]))
  }, [])

  return (
    <FilterContext value={{ filters, setFilters, outsourcingProjectIds }}>
      <div className="min-h-screen bg-neutral-50">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-lg font-semibold text-neutral-900">
                Elogic Dashboard
              </Link>
              <nav className="flex gap-1">
                {navItems.map((item) => {
                  const active = item.to === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.to)
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
            <FilterBar
              value={filters}
              onChange={setFilters}
              hideDateRange={isDashboard}
              hideProjects={isPeopleList}
              hideUsers={isProjectsList}
              scopedProjectIds={isDashboard ? outsourcingProjectIds : undefined}
            />
          )}
          <Outlet />
        </main>
      </div>
    </FilterContext>
  )
}
