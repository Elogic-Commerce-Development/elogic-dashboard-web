import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { AppLayout } from '@/components/AppLayout'
import { RadarPage } from '@/pages/RadarPage'
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

/**
 * `/` is Radar's address per §3, and F3 ships it as a redirect rather than by
 * mounting Radar on the index route: the old Dashboard still owns
 * `?period=…` bookmarks, and a redirect keeps `/radar` as the one canonical
 * URL people can link to and share.
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/radar' })
  },
})

const radarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/radar',
  component: RadarPage,
})

/**
 * The pre-redesign Dashboard, moved off `/` and kept reachable until F4 lands
 * the Estimation page — §4.1 sends its adoption/accuracy charts there, so
 * deleting it now would delete charts with nowhere to live.
 */
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
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
  indexRoute,
  radarRoute,
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
