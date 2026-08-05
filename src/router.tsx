import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppLayout } from '@/components/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { EstimatesPage } from '@/pages/EstimatesPage'
import { PeoplePage } from '@/pages/PeoplePage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { ProjectDetailPage } from '@/pages/ProjectDetailPage'
import { ContributorDetailPage } from '@/pages/ContributorDetailPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { PERIOD_GROUPS, parsePeriodSearch, type PeriodGroup, type PeriodPreset } from '@/lib/period'

/**
 * Every period-aware route carries the same search contract: a `period`
 * preset plus the `from`/`to` bounds a custom range needs.
 *
 * All three fields are optional, so existing `<Link to="/people/$userId">`
 * call sites without `search` still type-check and a page at its default
 * period has a clean URL. Defaults are resolved in the page component, not
 * here — `parsePeriodSearch` only rejects presets the surface doesn't offer
 * (and rewrites legacy `?preset=` / `?period=6m` URLs onto the unified
 * vocabulary).
 */
export type PeriodSearch = {
  period?: PeriodPreset
  from?: string
  to?: string
}

/** Back-compat alias — the detail routes' search shape has not changed. */
export type ContributorDetailSearch = PeriodSearch
export type ProjectDetailSearch = PeriodSearch
export type DashboardSearch = PeriodSearch

function periodSearchValidator(group: PeriodGroup) {
  return (search: Record<string, unknown>): PeriodSearch => ({
    period: parsePeriodSearch(search, group),
    from: typeof search.from === 'string' ? search.from : undefined,
    to: typeof search.to === 'string' ? search.to : undefined,
  })
}

const rootRoute = createRootRoute({
  component: AppLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
  validateSearch: periodSearchValidator(PERIOD_GROUPS.dashboard),
})

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overview',
  component: OverviewPage,
  validateSearch: periodSearchValidator(PERIOD_GROUPS.list),
})

const estimatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/estimates',
  component: EstimatesPage,
  validateSearch: periodSearchValidator(PERIOD_GROUPS.list),
})

const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/people',
  component: PeoplePage,
  validateSearch: periodSearchValidator(PERIOD_GROUPS.list),
})

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
  validateSearch: periodSearchValidator(PERIOD_GROUPS.list),
})

const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectDetailPage,
  validateSearch: periodSearchValidator(PERIOD_GROUPS.project),
})

const contributorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/people/$userId',
  component: ContributorDetailPage,
  validateSearch: periodSearchValidator(PERIOD_GROUPS.person),
})

const taskDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/$taskId',
  component: TaskDetailPage,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  overviewRoute,
  estimatesRoute,
  peopleRoute,
  projectsRoute,
  projectDetailRoute,
  contributorDetailRoute,
  taskDetailRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
