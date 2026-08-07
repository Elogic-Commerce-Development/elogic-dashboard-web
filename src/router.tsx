import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { AppLayout } from '@/components/AppLayout'
import { RadarPage } from '@/pages/RadarPage'
import { EstimationPage } from '@/pages/EstimationPage'
import { QualityPage } from '@/pages/QualityPage'
import { WriteOffsPage } from '@/pages/WriteOffsPage'
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
 * `/dashboard` is gone as of F7, on the owner's call.
 *
 * It was the last pre-redesign page: §4.1 had already given its KPI cards to
 * Radar and §4.2 its adoption/accuracy charts to Estimation, and it was the
 * only surface still reading the legacy `v_dashboard_*` generation — whole
 * company, back to 2017, a different population from every §5 figure beside
 * it. F4 left it standing because "cutting a live page nobody asked to cut is
 * not a deletion this session owns"; the progress log then carried it as an
 * open question with the note that the cheapest sequencing was to cut it once
 * Quality had a home for its signals section. Quality now does — rebuilt on
 * the canonical views rather than inherited on the legacy ones.
 *
 * A bookmark to `/dashboard` now 404s rather than redirecting: the page's
 * content is split across three different routes, so there is no honest single
 * destination to send someone to.
 */

/**
 * §4.2. No `validateSearch`: the page has no period control, so it has no
 * search contract to validate — every figure is the all-time canonical value
 * and the two trends own their own windows.
 */
const estimationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/estimation',
  component: EstimationPage,
})

/**
 * §4.5. No `validateSearch`, for the same reason `/estimation` has none: F5
 * turned this from a period-scoped grid into a page of coaching cards whose
 * figures sit at four different grains on purpose — calibration is the
 * all-time §5 sample, coverage all-time, load the last complete month, the
 * trend the last six. One page-level period control would imply they move
 * together. Each block states its own window instead.
 *
 * Pre-F5 bookmarks carrying `?period=…` still resolve: the param is simply
 * ignored rather than rejected.
 */
/**
 * §4.3 and §4.4. No `validateSearch`, for the same reason `/estimation` has
 * none: neither page has a period control. Each metric owns the window its
 * definition implies — the ladder and the ledger are the all-time §5 figures,
 * and the two trends run the full series from the 2025 floor, which is the
 * only window a drift signal can be read against.
 */
const qualityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/quality',
  component: QualityPage,
})

const writeOffsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/write-offs',
  component: WriteOffsPage,
})

const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/people',
  component: PeoplePage,
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
  estimationRoute,
  qualityRoute,
  writeOffsRoute,
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
