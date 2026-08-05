import { supabase } from './supabase'
import type { Filters } from './filters'

/**
 * AC user `class` values we analyse on the People grid + Users filter.
 * Everything else (Client, Client+, …) is dropped — they're not team members.
 */
export const TEAM_ROLES = ['Owner', 'Member']

export type TaskWithoutEstimate = {
  id: number
  name: string
  project_id: number
  project_name: string
  assignee_id: number | null
  assignee_name: string | null
  created_on: string
  due_on: string | null
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
}

export type TaskActualVsEstimate = {
  task_id: number
  project_id: number
  project_name: string
  assignee_id: number | null
  assignee_name: string | null
  task_name: string
  estimate_hours: number | null
  actual_hours: number
  ratio: number | null
  is_completed: boolean
  completed_on: string | null
  created_on: string
  last_record_date: string | null
  qa_iterations: number | null
  qa_iterations_capped: boolean
  qa_bugs: number | null
  qa_bugs_capped: boolean
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
}

export type EstimateAccuracyByProject = {
  project_id: number
  project_name: string
  estimated_tasks: number
  total_tasks: number
  mean_ratio: number | null
  median_ratio: number | null
  source: string | null
  project_jira_key: string | null
}

export type SyncStatusRow = {
  last_successful_sync: string | null
  task_count: number
  time_record_count: number
}

export type GlobalKpis = {
  unestimated_tasks_with_time: number
  unestimated_hours: number
  overrun_tasks: number
  overrun_hours: number
  estimate_adoption_rate: number | null
  total_tasks: number
  total_hours: number
}

export type ContributorStats = {
  contributor_id: number
  contributor_name: string
  tasks_contributed_to: number
  unestimated_tasks: number
  overrun_tasks: number
  total_hours: number
  hours_on_unestimated: number
  hours_on_overrun: number
  estimate_adoption: number | null
  projects_contributed_to: number
  /** Distinct non-completed projects the person logged time on. */
  active_projects_contributed_to: number
  /** AC role discriminator (Owner / Member / Client …); People grid keeps Owner+Member. */
  class: string | null
  mean_ratio: number | null
  median_ratio: number | null
  /** Bugs Rate: avg qa_bugs over the contributor's labeled tasks (null when none) */
  avg_qa_bugs: number | null
  qa_bugs_tasks: number
  /** Return Rate: avg qa_iterations over the contributor's labeled tasks */
  avg_qa_iterations: number | null
  qa_iterations_tasks: number
}

export type ContributorTaskSummary = {
  contributor_id: number
  contributor_name: string
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  assignee_id: number | null
  estimate_hours: number | null
  contributor_hours: number
  task_actual_hours: number
  is_completed: boolean
  completed_on: string | null
  created_on: string
  qa_iterations: number | null
  qa_iterations_capped: boolean
  qa_bugs: number | null
  qa_bugs_capped: boolean
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
}

export type TaskContributor = {
  task_id: number
  contributor_id: number
  contributor_name: string
  hours: number
  share: number | null
}

export type MonthlyTrend = {
  month: string
  active_tasks: number
  total_hours: number
  unestimated_tasks: number
  unestimated_hours: number
  overrun_tasks: number
  overrun_hours: number
  estimate_adoption_rate: number | null
}

export type DashboardKpiMonth = {
  month: string
  total_tasks: number
  estimated_tasks: number
  total_hours: number
  unestimated_tasks_with_time: number
  unestimated_hours: number
  overrun_tasks: number
  overrun_hours: number
}

export type DashboardAccuracyMonth = {
  month: string
  mean_usage: number | null
  min_usage: number | null
  max_usage: number | null
  sample_size: number
}

export type DashboardQualityMonth = {
  month: string
  iter_median: number | null
  iter_p25: number | null
  iter_p75: number | null
  iter_sample_size: number
  iter_any_capped: boolean
  bug_median: number | null
  bug_p25: number | null
  bug_p75: number | null
  bug_sample_size: number
  bug_any_capped: boolean
}

export type RecentUnestimated = {
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  recent_hours: number
  total_hours: number
  last_record_date: string
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
}

export type RecentOverrun = {
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  estimate_hours: number
  actual_hours: number
  ratio: number
  recent_hours: number
  last_record_date: string
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
}

export type ProjectListItem = { id: number; name: string; label_id: number | null; is_completed: boolean }
export type UserListItem = { id: number; display_name: string; class: string | null }

export type UserDetail = {
  id: number
  display_name: string
  email: string
  class: string | null
  is_archived: boolean
  is_trashed: boolean
  peopleforce_id: number | null
}

export type EmployeeDay = {
  user_id: number
  display_name: string
  pf_id: number
  pf_status: string | null
  date: string                              // ISO date YYYY-MM-DD
  isodow: number                            // 1=Mon..7=Sun
  is_weekend: boolean
  expected_hours_base: number               // pattern hours (0 on weekends)
  holiday_name: string | null
  holiday_is_working: boolean
  is_non_working_holiday: boolean
  leave_bucket:
    | 'vacation' | 'sick' | 'other_paid' | 'other_unpaid'
    | 'wfh' | 'bench' | 'unmapped'
    | null
  leave_policy_name: string | null
  leave_amount: number | null
  leave_unit: 'days' | 'hours' | null
  expected_hours: number                    // after weekend/holiday/leave reductions
  tracked_hours: number
}

/**
 * `created_on` is a timestamptz; a bare `lte <date>` stops at that day's
 * 00:00 UTC and drops same-day tasks. Bump the To bound to end-of-day so the
 * range is inclusive. (`record_date` is a DATE column and doesn't need this.)
 */
function createdOnTo(to: string): string {
  return `${to}T23:59:59.999`
}

/** Continuous median, matching Postgres PERCENTILE_CONT(0.5). */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export async function fetchTasksWithoutEstimates(filters: Filters): Promise<TaskWithoutEstimate[]> {
  let q = supabase
    .from('v_tasks_without_estimates')
    .select('*')
    .order('created_on', { ascending: false })
    .limit(500)

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
  if (filters.from) q = q.gte('created_on', filters.from)
  if (filters.to) q = q.lte('created_on', createdOnTo(filters.to))

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskWithoutEstimate[]
}

/**
 * Exact filtered row counts for the Overview accordion headers. Uses HEAD +
 * count so it stays cheap and reflects the true total (not the 500-row display
 * cap). Same filter chain as the two Overview tables.
 */
export async function fetchOverviewCounts(
  filters: Filters,
): Promise<{ withoutEstimates: number; overrun: number }> {
  const countOf = async (view: string): Promise<number> => {
    let q = supabase.from(view).select('*', { count: 'exact', head: true })
    if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
    if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
    if (filters.from) q = q.gte('created_on', filters.from)
    if (filters.to) q = q.lte('created_on', createdOnTo(filters.to))
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  }
  const [withoutEstimates, overrun] = await Promise.all([
    countOf('v_tasks_without_estimates'),
    countOf('v_tasks_overrun'),
  ])
  return { withoutEstimates, overrun }
}

export async function fetchTasksOverrun(filters: Filters): Promise<TaskActualVsEstimate[]> {
  let q = supabase
    .from('v_tasks_overrun')
    .select('*')
    .order('ratio', { ascending: false })
    .limit(500)

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
  if (filters.from) q = q.gte('created_on', filters.from)
  if (filters.to) q = q.lte('created_on', createdOnTo(filters.to))

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchAllTasksFiltered(projectIds: number[], userIds: number[]): Promise<TaskActualVsEstimate[]> {
  // PostgREST caps each response at 1000 rows by default. The outsourcing
  // scope can exceed that, so walk pages until we get a short page.
  const PAGE = 1000
  const all: TaskActualVsEstimate[] = []
  let offset = 0
  while (true) {
    let q = supabase
      .from('v_task_actual_vs_estimate')
      .select('*')
      .order('created_on', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (projectIds.length > 0) q = q.in('project_id', projectIds)
    if (userIds.length > 0) q = q.in('assignee_id', userIds)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as TaskActualVsEstimate[]
    all.push(...rows)
    if (rows.length < PAGE) break
    offset += PAGE
  }
  return all
}

export async function fetchActualVsEstimate(filters: Filters): Promise<TaskActualVsEstimate[]> {
  let q = supabase
    .from('v_task_actual_vs_estimate')
    .select('*')
    .not('estimate_hours', 'is', null)
    .order('created_on', { ascending: false })
    .limit(500)

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
  if (filters.from) q = q.gte('created_on', filters.from)
  if (filters.to) q = q.lte('created_on', createdOnTo(filters.to))

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchAccuracyByProject(filters: Filters): Promise<EstimateAccuracyByProject[]> {
  // No date range → the all-time view.
  if (!filters.from && !filters.to) {
    let q = supabase
      .from('v_estimate_accuracy_by_project')
      .select('*')
      .order('estimated_tasks', { ascending: false })
    if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as EstimateAccuracyByProject[]
  }

  // Date range → recompute client-side over completed tasks created in the
  // window, mirroring v_estimate_accuracy_by_project (completed tasks only,
  // grouped by project, mean/median over non-null ratios). The all-time view
  // can't be date-filtered, so walk v_task_actual_vs_estimate and aggregate.
  type Row = { project_id: number; project_name: string; estimate_hours: number | null; ratio: number | null; source: string | null; project_jira_key: string | null }
  const rows: Row[] = []
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from('v_task_actual_vs_estimate')
      .select('project_id, project_name, estimate_hours, ratio, source, project_jira_key')
      .eq('is_completed', true)
      .order('task_id')
      .range(offset, offset + PAGE - 1)
    if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
    if (filters.from) q = q.gte('created_on', filters.from)
    if (filters.to) q = q.lte('created_on', createdOnTo(filters.to))
    const { data, error } = await q
    if (error) throw error
    const page = (data ?? []) as Row[]
    rows.push(...page)
    if (page.length < PAGE) break
  }

  type Acc = { project_name: string; total: number; estimated: number; ratios: number[]; source: string | null; project_jira_key: string | null }
  const byProject = new Map<number, Acc>()
  for (const r of rows) {
    let acc = byProject.get(r.project_id)
    if (!acc) {
      acc = { project_name: r.project_name, total: 0, estimated: 0, ratios: [], source: r.source, project_jira_key: r.project_jira_key }
      byProject.set(r.project_id, acc)
    }
    acc.total++
    if (r.estimate_hours != null) acc.estimated++
    if (r.ratio != null) acc.ratios.push(Number(r.ratio))
  }

  const result: EstimateAccuracyByProject[] = []
  for (const [project_id, acc] of byProject.entries()) {
    result.push({
      project_id,
      project_name: acc.project_name,
      estimated_tasks: acc.estimated,
      total_tasks: acc.total,
      mean_ratio: acc.ratios.length ? acc.ratios.reduce((a, b) => a + b, 0) / acc.ratios.length : null,
      median_ratio: median(acc.ratios),
      source: acc.source,
      project_jira_key: acc.project_jira_key,
    })
  }
  return result.sort((a, b) => b.estimated_tasks - a.estimated_tasks)
}

export async function fetchSyncStatus(): Promise<SyncStatusRow | null> {
  const { data, error } = await supabase.from('v_sync_status').select('*').maybeSingle()
  if (error) throw error
  return (data as SyncStatusRow | null) ?? null
}

export async function fetchProjects(): Promise<ProjectListItem[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, label_id, is_completed')
    .eq('is_trashed', false)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProjectListItem[]
}

/** project_id → is_completed map for client-side active/completed filtering. */
export async function fetchProjectCompletedMap(): Promise<Map<number, boolean>> {
  const projects = await fetchProjects()
  return new Map(projects.map((p) => [p.id, Boolean(p.is_completed)]))
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, class')
    .eq('is_archived', false)
    .in('class', TEAM_ROLES) // drop Client/Client+ — not analysed
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserListItem[]
}

export async function fetchContributorTaskSummary(
  contributorId: number,
  range?: { from?: string; to?: string },
): Promise<ContributorTaskSummary[]> {
  // No range → all-time view.
  if (!range?.from && !range?.to) {
    const { data, error } = await supabase
      .from('v_contributor_task_summary')
      .select('*')
      .eq('contributor_id', contributorId)
      .order('created_on', { ascending: false })
    if (error) throw error
    return (data ?? []) as ContributorTaskSummary[]
  }

  // Periodized view. The pre-aggregated view filters wouldn't work — the
  // view's `contributor_hours` is all-time, and filtering by task `created_on`
  // hides legacy recurring tasks ("Daily meetings", "Standup") that the user
  // may have logged time against during the period. Walk `time_records`
  // directly with an embedded task+project and aggregate client-side.
  const from = range.from ?? '0001-01-01'
  const to = range.to ?? '9999-12-31'

  type RawRow = {
    task_id: number
    value_hours: number
    task: {
      id: number
      name: string
      project_id: number
      assignee_id: number | null
      estimate_hours: number | null
      is_completed: boolean
      completed_on: string | null
      created_on: string
      qa_iterations: number | null
      qa_iterations_capped: boolean
      qa_bugs: number | null
      qa_bugs_capped: boolean
      source: string | null
      jira_key: string | null
      project: { id: number; name: string; jira_key: string | null } | null
    } | null
  }

  // Q1: this user's records in period with task + project embedded.
  // PostgREST caps each response at 1000 rows regardless of .limit(), so
  // walk pages (.order for stable pagination) until a short page.
  const PAGE = 1000
  const myRows: RawRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data: mine, error: mineErr } = await supabase
      .from('time_records')
      .select(
        'task_id, value_hours, task:tasks(id, name, project_id, assignee_id, estimate_hours, is_completed, completed_on, created_on, qa_iterations, qa_iterations_capped, qa_bugs, qa_bugs_capped, source, jira_key, project:projects(id, name, jira_key))',
      )
      .eq('user_id', contributorId)
      .eq('is_trashed', false)
      .gte('record_date', from)
      .lte('record_date', to)
      .not('task_id', 'is', null)
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (mineErr) throw mineErr
    const rows = (mine ?? []) as unknown as RawRow[]
    myRows.push(...rows)
    if (rows.length < PAGE) break
  }
  if (myRows.length === 0) return []

  // Aggregate this user's hours per task and stash task metadata.
  const perTask = new Map<
    number,
    { my_hours: number; task: NonNullable<RawRow['task']> }
  >()
  for (const r of myRows) {
    if (!r.task) continue
    const existing = perTask.get(r.task_id)
    if (existing) {
      existing.my_hours += Number(r.value_hours)
    } else {
      perTask.set(r.task_id, { my_hours: Number(r.value_hours), task: r.task })
    }
  }

  // Q2: every user's hours on those tasks in the same period — for the
  // "Total Tracked" + "Share" columns. Chunk the .in() list (ids travel in
  // the GET querystring) and page within each chunk past the 1000-row cap.
  const taskIds = Array.from(perTask.keys())
  const taskTotals = new Map<number, number>()
  const CHUNK = 200
  for (let i = 0; i < taskIds.length; i += CHUNK) {
    const chunk = taskIds.slice(i, i + CHUNK)
    for (let offset = 0; ; offset += PAGE) {
      const { data: allRows, error: allErr } = await supabase
        .from('time_records')
        .select('task_id, value_hours')
        .in('task_id', chunk)
        .eq('is_trashed', false)
        .gte('record_date', from)
        .lte('record_date', to)
        .order('id')
        .range(offset, offset + PAGE - 1)
      if (allErr) throw allErr
      const rows = (allRows ?? []) as { task_id: number; value_hours: number }[]
      for (const r of rows) {
        taskTotals.set(r.task_id, (taskTotals.get(r.task_id) ?? 0) + Number(r.value_hours))
      }
      if (rows.length < PAGE) break
    }
  }

  // We need the contributor's display name once. Look it up from any users
  // table row — cheap and lets us match the existing return shape.
  const { data: contribRow } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', contributorId)
    .maybeSingle()
  const contributorName = (contribRow?.display_name as string | undefined) ?? `User #${contributorId}`

  const summaries: ContributorTaskSummary[] = []
  for (const [taskId, { my_hours, task }] of perTask.entries()) {
    summaries.push({
      contributor_id: contributorId,
      contributor_name: contributorName,
      task_id: taskId,
      task_name: task.name,
      project_id: task.project_id,
      project_name: task.project?.name ?? '',
      assignee_id: task.assignee_id,
      estimate_hours: task.estimate_hours,
      contributor_hours: my_hours,
      task_actual_hours: taskTotals.get(taskId) ?? my_hours,
      is_completed: task.is_completed,
      completed_on: task.completed_on,
      created_on: task.created_on,
      qa_iterations: task.qa_iterations,
      qa_iterations_capped: task.qa_iterations_capped,
      qa_bugs: task.qa_bugs,
      qa_bugs_capped: task.qa_bugs_capped,
      source: task.source,
      task_jira_key: task.jira_key,
      project_jira_key: task.project?.jira_key ?? null,
    })
  }
  // Most recently created first (matches the all-time fetcher's order).
  summaries.sort((a, b) => (a.created_on < b.created_on ? 1 : -1))
  return summaries
}

export async function fetchUserDetail(userId: number): Promise<UserDetail | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, email, class, is_archived, is_trashed, peopleforce_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as UserDetail | null) ?? null
}

export type TaskTimeEntry = {
  id: number
  user_id: number
  user_name: string
  job_type_id: number | null
  job_type_name: string | null
  hours: number
  record_date: string             // ISO date — when the work was done
  created_on: string              // ISO timestamp — when the entry was added in AC
  billable_status: number | null  // AC enum: 0=not billable, 1=billable, 2=already billed, 3=pending payment
  summary: string | null          // free-text description on the entry
}

type RawTaskTimeEntry = {
  id: number
  user_id: number
  job_type_id: number | null
  value_hours: number
  record_date: string
  created_on: string
  billable_status: number | null
  summary: string | null
  user: { id: number; display_name: string } | null
  job_type: { id: number; name: string } | null
}

/**
 * Raw time-record entries for a single task, joined to user and job_type
 * via PostgREST embed. Returned in record_date desc order so the most
 * recent work is at the top.
 */
export async function fetchTaskTimeRecordEntries(taskId: number): Promise<TaskTimeEntry[]> {
  const { data, error } = await supabase
    .from('time_records')
    .select('id, user_id, job_type_id, value_hours, record_date, created_on, billable_status, summary, user:users(id,display_name), job_type:job_types(id,name)')
    .eq('task_id', taskId)
    .eq('is_trashed', false)
    .order('record_date', { ascending: false })
    .order('created_on', { ascending: false })
    .limit(2000)
  if (error) throw error

  return ((data ?? []) as unknown as RawTaskTimeEntry[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_name: r.user?.display_name ?? `User #${r.user_id}`,
    job_type_id: r.job_type_id,
    job_type_name: r.job_type?.name ?? null,
    hours: Number(r.value_hours),
    record_date: r.record_date,
    created_on: r.created_on,
    billable_status: r.billable_status,
    summary: r.summary,
  }))
}

/**
 * Per-(user, day) rows from v_employee_day filtered to the given range.
 * Returns [] if the user has no PF link (the view INNER JOINs to pf_employees
 * via peopleforce_id IS NOT NULL, so unlinked users have no rows).
 *
 * The range is inclusive on both ends (PostgREST `gte` + `lte` against `date`).
 *
 * Even a year of daily rows is ~365 — well under Supabase's default 1000 row
 * limit. We bump it to 2000 just in case to handle 2-year custom ranges.
 */
export async function fetchEmployeeDays(
  userId: number,
  from: string,
  to: string,
): Promise<EmployeeDay[]> {
  const { data, error } = await supabase
    .from('v_employee_day')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .limit(2000)
  if (error) throw error
  return (data ?? []) as EmployeeDay[]
}

export async function fetchTaskContributors(taskId: number): Promise<TaskContributor[]> {
  const { data, error } = await supabase
    .from('v_task_contributors')
    .select('*')
    .eq('task_id', taskId)
    .order('hours', { ascending: false })
  if (error) throw error
  return (data ?? []) as TaskContributor[]
}

/* ── Canonical §5 metric layer (F2) ─────────────────────────────────────────
 *
 * The People and Projects grids read the `v_metric_*` family — the one SQL
 * definition per metric that session S3/R5 shipped — instead of the legacy
 * all-time `v_contributor_stats` / `v_project_stats` (whole company, back to
 * 2017, no scope filter) and the client-side `periodStats.ts` re-aggregation.
 *
 * Two sources, one row shape:
 *
 *   all time     v_metric_coverage_by_{person,project} + v_metric_overrun_by_*
 *   one month    v_metric_{person,project}_month  (R8)
 *
 * Only those two. The month views are grained per (grain, month), so their
 * task counters are distinct *within a month* — summing several months
 * double-counts any task worked in more than one (measured +30% person /
 * +56% project across the full range), and the all-time views carry no date
 * filter. A range that is neither "all" nor "exactly one month" therefore has
 * no exact canonical source, which is why `PERIOD_GROUPS.grid` offers only
 * these three presets. See docs/progress-log.md, F2.
 *
 * The two overrun columns differ in basis between the sources, deliberately
 * and visibly (the grids re-label the header):
 *   - all time  §5 attribution — the overrun *amount* (actual − estimate)
 *               charged to whoever holds ≥40% of a task's hours;
 *   - month     contribution — the grain's own hours on tasks that overran.
 * Both are canonical; they answer different questions. Neither is a sum of
 * the other, so they are never mixed inside one column.
 */

/** Shared row shape for both grids' two sources. */
type MetricGridRow = {
  hours: number
  tasks: number
  estimated_tasks: number
  coverage_pct: number | null
  overrun_tasks: number
  overrun_hours: number
}

export type PersonMetricRow = MetricGridRow & {
  user_id: number
  display_name: string
}

export type ProjectMetricRow = MetricGridRow & {
  project_id: number
  project_name: string
  source: string | null
  is_completed: boolean
}

/**
 * FilterBar user ids → canonical (R6-merged) ids.
 *
 * The canonical views key on the merged person, so a raw alias id — 16 of the
 * 334 accounts — matches nothing. Selecting "Vladyslav Zdrachuk" (255) has to
 * find the person's rows under 3579. Identity-mapped for everyone else, so
 * this is a no-op for the other 318.
 */
export async function resolveCanonicalUserIds(userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return []
  const { data, error } = await supabase
    .from('v_person_alias')
    .select('user_id, canonical_user_id')
    .in('user_id', userIds)
  if (error) throw error
  const rows = (data ?? []) as { user_id: number; canonical_user_id: number }[]
  const byRaw = new Map(rows.map((r) => [r.user_id, r.canonical_user_id]))
  return Array.from(new Set(userIds.map((id) => byRaw.get(id) ?? id)))
}

/** `2026-08-01` for the calendar month a period's start date falls in. */
export function monthKey(from: string): string {
  return `${from.slice(0, 7)}-01`
}

type CoverageByPerson = {
  user_id: number
  display_name: string
  tasks: number
  estimated_tasks: number
  hours: number
  estimated_hours: number
}
type OverrunByPerson = {
  user_id: number
  realized_overrun_tasks: number
  realized_overrun_hours: number
  live_overrun_tasks: number
  live_overrun_hours: number
}

/**
 * Coverage is grained per (person, is_estimating_segment), so a person who
 * works across both segment classes has two rows. Roll them up before
 * anything else reads a count.
 */
export async function fetchPersonMetricsAllTime(userIds: number[]): Promise<PersonMetricRow[]> {
  const canonicalIds = await resolveCanonicalUserIds(userIds)

  let covQ = supabase
    .from('v_metric_coverage_by_person')
    .select('user_id, display_name, tasks, estimated_tasks, hours, estimated_hours')
  if (canonicalIds.length > 0) covQ = covQ.in('user_id', canonicalIds)

  let ovrQ = supabase
    .from('v_metric_overrun_by_person')
    .select('user_id, realized_overrun_tasks, realized_overrun_hours, live_overrun_tasks, live_overrun_hours')
  if (canonicalIds.length > 0) ovrQ = ovrQ.in('user_id', canonicalIds)

  const [cov, ovr] = await Promise.all([covQ, ovrQ])
  if (cov.error) throw cov.error
  if (ovr.error) throw ovr.error

  const overrun = new Map(
    ((ovr.data ?? []) as OverrunByPerson[]).map((o) => [o.user_id, o]),
  )

  const byPerson = new Map<number, { display_name: string; tasks: number; estimated_tasks: number; hours: number; estimated_hours: number }>()
  for (const r of (cov.data ?? []) as CoverageByPerson[]) {
    const acc = byPerson.get(r.user_id)
    if (acc) {
      acc.tasks += Number(r.tasks)
      acc.estimated_tasks += Number(r.estimated_tasks)
      acc.hours += Number(r.hours)
      acc.estimated_hours += Number(r.estimated_hours)
    } else {
      byPerson.set(r.user_id, {
        display_name: r.display_name,
        tasks: Number(r.tasks),
        estimated_tasks: Number(r.estimated_tasks),
        hours: Number(r.hours),
        estimated_hours: Number(r.estimated_hours),
      })
    }
  }

  const rows: PersonMetricRow[] = []
  for (const [user_id, a] of byPerson.entries()) {
    const o = overrun.get(user_id)
    rows.push({
      user_id,
      display_name: a.display_name,
      hours: a.hours,
      tasks: a.tasks,
      estimated_tasks: a.estimated_tasks,
      coverage_pct: a.hours > 0 ? (a.estimated_hours / a.hours) * 100 : null,
      // §5 gross overrun — realized + live, never netted. The two are
      // disjoint (a task is completed or it is open), so this is a count.
      overrun_tasks: Number(o?.realized_overrun_tasks ?? 0) + Number(o?.live_overrun_tasks ?? 0),
      overrun_hours: Number(o?.realized_overrun_hours ?? 0) + Number(o?.live_overrun_hours ?? 0),
    })
  }
  return rows.sort((a, b) => b.hours - a.hours)
}

type PersonMonth = {
  user_id: number
  display_name: string
  total_hours: number
  tasks_touched: number
  estimated_tasks: number
  coverage_pct: number | null
  realized_overrun_tasks_touched: number
  hours_on_realized_overrun: number
  live_overrun_tasks_touched: number
  hours_on_live_overrun: number
}

export async function fetchPersonMetricsForMonth(
  month: string,
  userIds: number[],
): Promise<PersonMetricRow[]> {
  const canonicalIds = await resolveCanonicalUserIds(userIds)
  let q = supabase
    .from('v_metric_person_month')
    .select(
      'user_id, display_name, total_hours, tasks_touched, estimated_tasks, coverage_pct, realized_overrun_tasks_touched, hours_on_realized_overrun, live_overrun_tasks_touched, hours_on_live_overrun',
    )
    .eq('month', month)
    .order('total_hours', { ascending: false })
  if (canonicalIds.length > 0) q = q.in('user_id', canonicalIds)
  const { data, error } = await q
  if (error) throw error

  return ((data ?? []) as PersonMonth[]).map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    hours: Number(r.total_hours),
    tasks: Number(r.tasks_touched),
    estimated_tasks: Number(r.estimated_tasks),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
    overrun_tasks:
      Number(r.realized_overrun_tasks_touched) + Number(r.live_overrun_tasks_touched),
    overrun_hours: Number(r.hours_on_realized_overrun) + Number(r.hours_on_live_overrun),
  }))
}

type CoverageByProject = {
  project_id: number
  project_name: string
  source: string | null
  tasks: number
  estimated_tasks: number
  hours: number
  estimated_hours: number
}
type OverrunByProject = {
  project_id: number
  realized_overrun_tasks: number
  live_overrun_tasks: number
  gross_overrun_hours: number
}

export async function fetchProjectMetricsAllTime(projectIds: number[]): Promise<ProjectMetricRow[]> {
  let covQ = supabase
    .from('v_metric_coverage_by_project')
    .select('project_id, project_name, source, tasks, estimated_tasks, hours, estimated_hours')
  if (projectIds.length > 0) covQ = covQ.in('project_id', projectIds)

  let ovrQ = supabase
    .from('v_metric_overrun_by_project')
    .select('project_id, realized_overrun_tasks, live_overrun_tasks, gross_overrun_hours')
  if (projectIds.length > 0) ovrQ = ovrQ.in('project_id', projectIds)

  const [cov, ovr, completed] = await Promise.all([covQ, ovrQ, fetchProjectCompletedMap()])
  if (cov.error) throw cov.error
  if (ovr.error) throw ovr.error

  const overrun = new Map(
    ((ovr.data ?? []) as OverrunByProject[]).map((o) => [o.project_id, o]),
  )

  const byProject = new Map<number, CoverageByProject>()
  for (const r of (cov.data ?? []) as CoverageByProject[]) {
    const acc = byProject.get(r.project_id)
    if (acc) {
      acc.tasks = Number(acc.tasks) + Number(r.tasks)
      acc.estimated_tasks = Number(acc.estimated_tasks) + Number(r.estimated_tasks)
      acc.hours = Number(acc.hours) + Number(r.hours)
      acc.estimated_hours = Number(acc.estimated_hours) + Number(r.estimated_hours)
    } else {
      byProject.set(r.project_id, { ...r })
    }
  }

  const rows: ProjectMetricRow[] = []
  for (const [project_id, a] of byProject.entries()) {
    const o = overrun.get(project_id)
    const hours = Number(a.hours)
    rows.push({
      project_id,
      project_name: a.project_name,
      source: a.source,
      hours,
      tasks: Number(a.tasks),
      estimated_tasks: Number(a.estimated_tasks),
      coverage_pct: hours > 0 ? (Number(a.estimated_hours) / hours) * 100 : null,
      overrun_tasks: Number(o?.realized_overrun_tasks ?? 0) + Number(o?.live_overrun_tasks ?? 0),
      overrun_hours: Number(o?.gross_overrun_hours ?? 0),
      is_completed: completed.get(project_id) ?? false,
    })
  }
  return rows.sort((a, b) => b.hours - a.hours)
}

type ProjectMonth = {
  project_id: number
  project_name: string
  source: string | null
  project_is_completed: boolean
  total_hours: number
  tasks_touched: number
  estimated_tasks: number
  coverage_pct: number | null
  realized_overrun_tasks_touched: number
  hours_on_realized_overrun: number
  live_overrun_tasks_touched: number
  hours_on_live_overrun: number
}

export async function fetchProjectMetricsForMonth(
  month: string,
  projectIds: number[],
): Promise<ProjectMetricRow[]> {
  let q = supabase
    .from('v_metric_project_month')
    .select(
      'project_id, project_name, source, project_is_completed, total_hours, tasks_touched, estimated_tasks, coverage_pct, realized_overrun_tasks_touched, hours_on_realized_overrun, live_overrun_tasks_touched, hours_on_live_overrun',
    )
    .eq('month', month)
    .order('total_hours', { ascending: false })
  if (projectIds.length > 0) q = q.in('project_id', projectIds)
  const { data, error } = await q
  if (error) throw error

  return ((data ?? []) as ProjectMonth[]).map((r) => ({
    project_id: r.project_id,
    project_name: r.project_name,
    source: r.source,
    hours: Number(r.total_hours),
    tasks: Number(r.tasks_touched),
    estimated_tasks: Number(r.estimated_tasks),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
    overrun_tasks:
      Number(r.realized_overrun_tasks_touched) + Number(r.live_overrun_tasks_touched),
    overrun_hours: Number(r.hours_on_realized_overrun) + Number(r.hours_on_live_overrun),
    is_completed: Boolean(r.project_is_completed),
  }))
}

/* ── Dashboard overview (server-side aggregation; see v_dashboard_* views) ── */

export async function fetchDashboardKpisMonthly(): Promise<DashboardKpiMonth[]> {
  const { data, error } = await supabase
    .from('v_dashboard_kpis_monthly')
    .select('*')
    .order('month', { ascending: true })
  if (error) throw error
  return (data ?? []) as DashboardKpiMonth[]
}

export async function fetchDashboardAccuracyMonthly(): Promise<DashboardAccuracyMonth[]> {
  const { data, error } = await supabase
    .from('v_dashboard_accuracy_monthly')
    .select('*')
    .order('month', { ascending: true })
  if (error) throw error
  return (data ?? []) as DashboardAccuracyMonth[]
}

export async function fetchDashboardQualityMonthly(): Promise<DashboardQualityMonth[]> {
  const { data, error } = await supabase
    .from('v_dashboard_quality_monthly')
    .select('*')
    .order('month', { ascending: true })
  if (error) throw error
  return (data ?? []) as DashboardQualityMonth[]
}

export async function fetchDashboardTrend(): Promise<MonthlyTrend[]> {
  const { data, error } = await supabase
    .from('v_dashboard_trend_monthly')
    .select('*')
    .order('month', { ascending: true })
  if (error) throw error
  return (data ?? []) as MonthlyTrend[]
}

/** Trailing-30-day cutoff (UTC date), matching the old client computeShortlists. */
function thirtyDaysAgoIso(): string {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return cutoff.toISOString().split('T')[0]
}

export async function fetchDashboardRecentOverruns(limit = 5): Promise<RecentOverrun[]> {
  // ratio > 1 ⟺ estimate_hours > 0 AND actual_hours > estimate_hours.
  const { data, error } = await supabase
    .from('v_dashboard_tasks')
    .select(
      'task_id, task_name, project_id, project_name, estimate_hours, actual_hours, ratio, last_record_date, source, task_jira_key, project_jira_key',
    )
    .gt('ratio', 1)
    .gte('last_record_date', thirtyDaysAgoIso())
    // actual_hours desc, then created_on/task_id desc as deterministic
    // tie-breakers — the old client sorted a created_on-desc list with a
    // stable sort, so ties resolved to the most-recent task. Without these,
    // PostgREST tie order is arbitrary and the top-5 could differ at a tie.
    .order('actual_hours', { ascending: false })
    .order('created_on', { ascending: false })
    .order('task_id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as Array<{
    task_id: number; task_name: string; project_id: number; project_name: string
    estimate_hours: number; actual_hours: number; ratio: number; last_record_date: string
    source: string | null; task_jira_key: string | null; project_jira_key: string | null
  }>).map((t) => ({
    task_id: t.task_id,
    task_name: t.task_name,
    project_id: t.project_id,
    project_name: t.project_name,
    estimate_hours: Number(t.estimate_hours),
    actual_hours: Number(t.actual_hours),
    ratio: Number(t.ratio),
    recent_hours: Number(t.actual_hours),
    last_record_date: t.last_record_date,
    source: t.source,
    task_jira_key: t.task_jira_key,
    project_jira_key: t.project_jira_key,
  }))
}

export async function fetchDashboardRecentUnestimated(limit = 5): Promise<RecentUnestimated[]> {
  const { data, error } = await supabase
    .from('v_dashboard_tasks')
    .select(
      'task_id, task_name, project_id, project_name, actual_hours, last_record_date, source, task_jira_key, project_jira_key',
    )
    .is('estimate_hours', null)
    .eq('is_completed', false)
    .gt('actual_hours', 0)
    .gte('last_record_date', thirtyDaysAgoIso())
    // Deterministic tie-breakers — see fetchDashboardRecentOverruns.
    .order('actual_hours', { ascending: false })
    .order('created_on', { ascending: false })
    .order('task_id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as Array<{
    task_id: number; task_name: string; project_id: number; project_name: string
    actual_hours: number; last_record_date: string
    source: string | null; task_jira_key: string | null; project_jira_key: string | null
  }>).map((t) => ({
    task_id: t.task_id,
    task_name: t.task_name,
    project_id: t.project_id,
    project_name: t.project_name,
    recent_hours: Number(t.actual_hours),
    total_hours: Number(t.actual_hours),
    last_record_date: t.last_record_date,
    source: t.source,
    task_jira_key: t.task_jira_key,
    project_jira_key: t.project_jira_key,
  }))
}
