import { supabase } from './supabase'
import { TEAM_ROLES, fetchProjectCompletedMap, fetchUserClassMap } from './queries'
import type { ContributorStats, ProjectStats, TaskActualVsEstimate } from './queries'

/**
 * Period-scoped stats for the People grid, Projects grid, and project page.
 *
 * The pre-aggregated views (v_contributor_stats / v_project_stats) are
 * all-time. When the user sets a date range we recompute the same shapes
 * client-side: walk time_records within the range, join task lifetime
 * metadata from v_task_actual_vs_estimate, and aggregate per contributor /
 * per project. Semantics mirror the views exactly:
 *
 * - hours are the hours logged WITHIN the period;
 * - a task is "overrun" by its LIFETIME actual vs estimate;
 * - QA rates average over distinct labeled tasks only (NULL skipped);
 * - records whose task is missing from the view (trashed) are dropped,
 *   matching the views' is_trashed filters.
 */

export type PeriodScope = {
  from?: string
  to?: string
  projectIds?: number[]
  userIds?: number[]
}

export type ProjectContributorRow = {
  contributor_id: number
  contributor_name: string
  hours: number
  tasks: number
  overrun_tasks: number
  hours_on_overrun: number
  avg_qa_bugs: number | null
  qa_bugs_tasks: number
  avg_qa_iterations: number | null
  qa_iterations_tasks: number
}

type PeriodTimeRecord = {
  user_id: number
  task_id: number
  project_id: number
  value_hours: number
}

const PAGE = 1000
// .in() ids travel in the GET querystring — keep chunks well under URL limits.
const IN_CHUNK = 200

export async function fetchPeriodTimeRecords(scope: PeriodScope): Promise<PeriodTimeRecord[]> {
  const all: PeriodTimeRecord[] = []
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from('time_records')
      .select('user_id, task_id, project_id, value_hours')
      .eq('is_trashed', false)
      .not('task_id', 'is', null)
    if (scope.from) q = q.gte('record_date', scope.from)
    if (scope.to) q = q.lte('record_date', scope.to)
    if (scope.projectIds && scope.projectIds.length > 0) q = q.in('project_id', scope.projectIds)
    if (scope.userIds && scope.userIds.length > 0) q = q.in('user_id', scope.userIds)
    const { data, error } = await q.order('id').range(offset, offset + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as PeriodTimeRecord[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

export async function fetchTaskMetaByIds(ids: number[]): Promise<Map<number, TaskActualVsEstimate>> {
  const meta = new Map<number, TaskActualVsEstimate>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    // One row per task in the view, so a chunk can never exceed the
    // 1000-row response cap — no inner pagination needed.
    const { data, error } = await supabase
      .from('v_task_actual_vs_estimate')
      .select('*')
      .in('task_id', chunk)
    if (error) throw error
    for (const row of (data ?? []) as TaskActualVsEstimate[]) {
      meta.set(row.task_id, row)
    }
  }
  return meta
}

/**
 * id → display_name for ALL users. Deliberately no is_archived filter —
 * archived people have historical time records and must keep their names
 * in period aggregations (the views' users join has no archive filter
 * either).
 */
export async function fetchUserNameMap(): Promise<Map<number, string>> {
  const names = new Map<number, string>()
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as { id: number; display_name: string }[]
    for (const r of rows) names.set(r.id, r.display_name)
    if (rows.length < PAGE) break
  }
  return names
}

function isLifetimeOverrun(meta: TaskActualVsEstimate): boolean {
  return meta.estimate_hours != null && Number(meta.actual_hours) > Number(meta.estimate_hours)
}

function avgOrNull(sum: number, n: number): number | null {
  return n > 0 ? sum / n : null
}

export function aggregateContributorStats(
  recs: PeriodTimeRecord[],
  meta: Map<number, TaskActualVsEstimate>,
  names: Map<number, string>,
  opts?: { projectCompleted?: Map<number, boolean>; userClass?: Map<number, string | null> },
): ContributorStats[] {
  type Acc = { hours: number; perTaskHours: Map<number, number> }
  const byUser = new Map<number, Acc>()
  for (const r of recs) {
    if (!meta.has(r.task_id)) continue
    let acc = byUser.get(r.user_id)
    if (!acc) {
      acc = { hours: 0, perTaskHours: new Map() }
      byUser.set(r.user_id, acc)
    }
    const h = Number(r.value_hours)
    acc.hours += h
    acc.perTaskHours.set(r.task_id, (acc.perTaskHours.get(r.task_id) ?? 0) + h)
  }

  const rows: ContributorStats[] = []
  for (const [userId, acc] of byUser.entries()) {
    let unestimated = 0
    let hoursOnUnestimated = 0
    let overrun = 0
    let hoursOnOverrun = 0
    let estimated = 0
    let bugsSum = 0
    let bugsN = 0
    let iterSum = 0
    let iterN = 0
    const projects = new Set<number>()

    for (const [taskId, taskHours] of acc.perTaskHours.entries()) {
      const m = meta.get(taskId)!
      projects.add(m.project_id)
      if (m.estimate_hours == null) {
        unestimated++
        hoursOnUnestimated += taskHours
      } else {
        estimated++
      }
      if (isLifetimeOverrun(m)) {
        overrun++
        hoursOnOverrun += taskHours
      }
      if (m.qa_bugs != null) {
        bugsSum += Number(m.qa_bugs)
        bugsN++
      }
      if (m.qa_iterations != null) {
        iterSum += Number(m.qa_iterations)
        iterN++
      }
    }

    const tasks = acc.perTaskHours.size
    let activeProjects = 0
    for (const pid of projects) {
      if (!(opts?.projectCompleted?.get(pid) ?? false)) activeProjects++
    }
    rows.push({
      contributor_id: userId,
      contributor_name: names.get(userId) ?? `User #${userId}`,
      tasks_contributed_to: tasks,
      unestimated_tasks: unestimated,
      overrun_tasks: overrun,
      total_hours: acc.hours,
      hours_on_unestimated: hoursOnUnestimated,
      hours_on_overrun: hoursOnOverrun,
      estimate_adoption: tasks > 0 ? estimated / tasks : null,
      projects_contributed_to: projects.size,
      active_projects_contributed_to: activeProjects,
      class: opts?.userClass?.get(userId) ?? null,
      // Ratio stats need completed-task filtering the grid no longer
      // displays — not recomputed in period mode.
      mean_ratio: null,
      median_ratio: null,
      avg_qa_bugs: avgOrNull(bugsSum, bugsN),
      qa_bugs_tasks: bugsN,
      avg_qa_iterations: avgOrNull(iterSum, iterN),
      qa_iterations_tasks: iterN,
    })
  }
  return rows.sort((a, b) => b.total_hours - a.total_hours)
}

export function aggregateProjectStats(
  recs: PeriodTimeRecord[],
  meta: Map<number, TaskActualVsEstimate>,
  projectCompleted?: Map<number, boolean>,
): ProjectStats[] {
  type Acc = {
    name: string
    hours: number
    perTaskHours: Map<number, number>
    users: Set<number>
    source: string | null
    jira_key: string | null
  }
  const byProject = new Map<number, Acc>()
  for (const r of recs) {
    const m = meta.get(r.task_id)
    if (!m) continue
    let acc = byProject.get(m.project_id)
    if (!acc) {
      acc = { name: m.project_name, hours: 0, perTaskHours: new Map(), users: new Set(), source: m.source, jira_key: m.project_jira_key }
      byProject.set(m.project_id, acc)
    }
    const h = Number(r.value_hours)
    acc.hours += h
    acc.perTaskHours.set(r.task_id, (acc.perTaskHours.get(r.task_id) ?? 0) + h)
    acc.users.add(r.user_id)
  }

  const rows: ProjectStats[] = []
  for (const [projectId, acc] of byProject.entries()) {
    let unestimated = 0
    let hoursOnUnestimated = 0
    let overrun = 0
    let hoursOnOverrun = 0
    let bugsSum = 0
    let bugsN = 0
    let iterSum = 0
    let iterN = 0

    for (const [taskId, taskHours] of acc.perTaskHours.entries()) {
      const m = meta.get(taskId)!
      if (m.estimate_hours == null) {
        unestimated++
        hoursOnUnestimated += taskHours
      }
      if (isLifetimeOverrun(m)) {
        overrun++
        hoursOnOverrun += taskHours
      }
      if (m.qa_bugs != null) {
        bugsSum += Number(m.qa_bugs)
        bugsN++
      }
      if (m.qa_iterations != null) {
        iterSum += Number(m.qa_iterations)
        iterN++
      }
    }

    rows.push({
      project_id: projectId,
      project_name: acc.name,
      tasks_with_time: acc.perTaskHours.size,
      unestimated_tasks: unestimated,
      overrun_tasks: overrun,
      total_hours: acc.hours,
      hours_on_unestimated: hoursOnUnestimated,
      hours_on_overrun: hoursOnOverrun,
      team_members: acc.users.size,
      source: acc.source,
      jira_key: acc.jira_key,
      avg_qa_bugs: avgOrNull(bugsSum, bugsN),
      qa_bugs_tasks: bugsN,
      avg_qa_iterations: avgOrNull(iterSum, iterN),
      qa_iterations_tasks: iterN,
      is_completed: projectCompleted?.get(projectId) ?? false,
    })
  }
  return rows.sort((a, b) => b.total_hours - a.total_hours)
}

export function aggregateProjectContributorStats(
  recs: PeriodTimeRecord[],
  meta: Map<number, TaskActualVsEstimate>,
  names: Map<number, string>,
): ProjectContributorRow[] {
  const stats = aggregateContributorStats(recs, meta, names)
  return stats.map((s) => ({
    contributor_id: s.contributor_id,
    contributor_name: s.contributor_name,
    hours: s.total_hours,
    tasks: s.tasks_contributed_to,
    overrun_tasks: s.overrun_tasks,
    hours_on_overrun: s.hours_on_overrun,
    avg_qa_bugs: s.avg_qa_bugs,
    qa_bugs_tasks: s.qa_bugs_tasks,
    avg_qa_iterations: s.avg_qa_iterations,
    qa_iterations_tasks: s.qa_iterations_tasks,
  }))
}

async function fetchMetaAndNames(recs: PeriodTimeRecord[]): Promise<{
  meta: Map<number, TaskActualVsEstimate>
  names: Map<number, string>
}> {
  const taskIds = Array.from(new Set(recs.map((r) => r.task_id)))
  const [meta, names] = await Promise.all([fetchTaskMetaByIds(taskIds), fetchUserNameMap()])
  return { meta, names }
}

export async function fetchContributorStatsForPeriod(scope: PeriodScope): Promise<ContributorStats[]> {
  const recs = await fetchPeriodTimeRecords(scope)
  if (recs.length === 0) return []
  const [{ meta, names }, projectCompleted, userClass] = await Promise.all([
    fetchMetaAndNames(recs),
    fetchProjectCompletedMap(),
    fetchUserClassMap(),
  ])
  const rows = aggregateContributorStats(recs, meta, names, { projectCompleted, userClass })
  // People grid: Owner/Member only, matching the all-time v_contributor_stats query.
  return rows.filter((r) => r.class != null && TEAM_ROLES.includes(r.class))
}

export async function fetchProjectStatsForPeriod(scope: PeriodScope): Promise<ProjectStats[]> {
  const recs = await fetchPeriodTimeRecords(scope)
  if (recs.length === 0) return []
  const [{ meta }, projectCompleted] = await Promise.all([
    fetchMetaAndNames(recs),
    fetchProjectCompletedMap(),
  ])
  return aggregateProjectStats(recs, meta, projectCompleted)
}

export type ProjectPeriodDetail = {
  taskRows: (TaskActualVsEstimate & { period_hours: number })[]
  contributors: ProjectContributorRow[]
}

export async function fetchProjectPeriodDetail(
  projectId: number,
  from: string,
  to: string,
): Promise<ProjectPeriodDetail> {
  const recs = await fetchPeriodTimeRecords({ from, to, projectIds: [projectId] })
  if (recs.length === 0) return { taskRows: [], contributors: [] }
  const { meta, names } = await fetchMetaAndNames(recs)

  const periodHoursByTask = new Map<number, number>()
  for (const r of recs) {
    if (!meta.has(r.task_id)) continue
    periodHoursByTask.set(r.task_id, (periodHoursByTask.get(r.task_id) ?? 0) + Number(r.value_hours))
  }

  const taskRows = Array.from(periodHoursByTask.entries())
    .map(([taskId, periodHours]) => ({ ...meta.get(taskId)!, period_hours: periodHours }))
    .sort((a, b) => (a.created_on < b.created_on ? 1 : -1))

  return { taskRows, contributors: aggregateProjectContributorStats(recs, meta, names) }
}
