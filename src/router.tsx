import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppLayout } from '@/components/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { EstimatesPage } from '@/pages/EstimatesPage'
import { PeoplePage } from '@/pages/PeoplePage'
import { ProjectDetailPage } from '@/pages/ProjectDetailPage'
import { ContributorDetailPage } from '@/pages/ContributorDetailPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { isValidPreset, type PeriodPreset } from '@/lib/period'

export type ContributorDetailSearch = {
  // All optional so existing <Link to="/people/$userId"> call sites without
  // search params remain valid. Component defaults to 'current_month' when
  // preset is missing.
  preset?: PeriodPreset
  from?: string
  to?: string
}

const rootRoute = createRootRoute({
  component: AppLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overview',
  component: OverviewPage,
})

const estimatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/estimates',
  component: EstimatesPage,
})

const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/people',
  component: PeoplePage,
})

const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectDetailPage,
})

const contributorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/people/$userId',
  component: ContributorDetailPage,
  validateSearch: (search: Record<string, unknown>): ContributorDetailSearch => {
    const rawPreset = typeof search.preset === 'string' ? search.preset : undefined
    return {
      preset: isValidPreset(rawPreset) ? rawPreset : undefined,
      from: typeof search.from === 'string' ? search.from : undefined,
      to: typeof search.to === 'string' ? search.to : undefined,
    }
  },
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
