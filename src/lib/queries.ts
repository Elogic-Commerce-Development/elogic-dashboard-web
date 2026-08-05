import { supabase } from './supabase'

/**
 * AC user `class` values we analyse on the People grid + Users filter.
 * Everything else (Client, Client+, …) is dropped — they're not team members.
 */
export const TEAM_ROLES = ['Owner', 'Member']

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

/**
 * One task's economics, canonical-first.
 *
 * `v_metric_tasks` is the §5 task grain — same predicates as every other page,
 * so a ratio here and a ratio on Radar cannot disagree. But it is *scoped*:
 * 4,489 in-scope 2025+ tasks against the legacy view's 20,852. Swapping
 * bluntly would turn every pre-2025 or out-of-scope task into "Task not
 * found", including ones the not-yet-migrated project page still links to.
 *
 * So: canonical when the task is in scope, the legacy whole-company view
 * otherwise, with `inScope` telling the page to say which it is showing. As
 * F6 migrates the project page the fallback becomes rare on its own; it is
 * never silent.
 */
export type TaskDetail = { task: TaskActualVsEstimate; inScope: boolean }

type MetricTaskRow = {
  task_id: number
  project_id: number
  project_name: string
  task_name: string
  assignee_id: number | null
  estimate_hours: number | null
  actual_hours: number
  ratio: number | null
  is_completed: boolean
  completed_on: string | null
  created_on: string
  last_time_on: string | null
  qa_iterations: number | null
  qa_iterations_capped: boolean
  qa_bugs: number | null
  qa_bugs_capped: boolean
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
}

export async function fetchTaskDetail(taskId: number): Promise<TaskDetail | null> {
  const canonical = await supabase
    .from('v_metric_tasks')
    .select(
      'task_id, project_id, project_name, task_name, assignee_id, estimate_hours, actual_hours, ratio, is_completed, completed_on, created_on, last_time_on, qa_iterations, qa_iterations_capped, qa_bugs, qa_bugs_capped, source, task_jira_key, project_jira_key',
    )
    .eq('task_id', taskId)
    .maybeSingle()
  if (canonical.error) throw canonical.error

  if (canonical.data) {
    const r = canonical.data as MetricTaskRow
    // v_metric_tasks carries assignee_id but not the name — assignee is
    // display metadata in §5, never attribution, so it is a separate lookup
    // rather than a column on the metric grain.
    let assignee_name: string | null = null
    if (r.assignee_id != null) {
      const { data } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', r.assignee_id)
        .maybeSingle()
      assignee_name = (data?.display_name as string | undefined) ?? null
    }
    const { last_time_on, ...rest } = r
    return { task: { ...rest, assignee_name, last_record_date: last_time_on }, inScope: true }
  }

  const legacy = await supabase
    .from('v_task_actual_vs_estimate')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle()
  if (legacy.error) throw legacy.error
  if (!legacy.data) return null
  return { task: legacy.data as TaskActualVsEstimate, inScope: false }
}

/**
 * Contributors on one task. In scope this is the canonical grain, so duplicate
 * accounts are already merged into one person (R6) — out of scope it falls
 * back to the legacy view, which has no merge.
 */
export async function fetchTaskContributors(
  taskId: number,
  inScope = true,
): Promise<TaskContributor[]> {
  if (!inScope) {
    const { data, error } = await supabase
      .from('v_task_contributors')
      .select('*')
      .eq('task_id', taskId)
      .order('hours', { ascending: false })
    if (error) throw error
    return (data ?? []) as TaskContributor[]
  }

  const { data, error } = await supabase
    .from('v_metric_task_contributors')
    .select('task_id, user_id, display_name, hours, share')
    .eq('task_id', taskId)
    .order('hours', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<{
    task_id: number
    user_id: number
    display_name: string | null
    hours: number
    share: number | null
  }>).map((r) => ({
    task_id: r.task_id,
    contributor_id: r.user_id,
    contributor_name: r.display_name ?? `User #${r.user_id}`,
    hours: Number(r.hours),
    share: r.share == null ? null : Number(r.share),
  }))
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

/* ────────────────────────────────────────────────────────────────────────────
 * F3 — Radar (plan §4.1)
 *
 * Radar reads three canonical families and re-derives nothing:
 *
 *   attention queue   v_metric_exposure  (§5 exposure ranking, internal order)
 *                     + v_metric_project_signals (the eight named signals)
 *   bleeding now      v_metric_tasks     (is_live_overrun / is_approaching)
 *   company vitals    v_metric_project_month + v_metric_person_month (R8)
 *                     + v_metric_scope_summary (write-off, no monthly view yet)
 *
 * Every threshold behind a sig_* boolean lives in `v_metric_config` on the DB
 * side — §4.1 is explicit that retuning is a SQL change, never a frontend one,
 * so nothing here compares an hour against a literal.
 * ──────────────────────────────────────────────────────────────────────────── */

/** One in-scope project's eight §4.1 signals, beside the counts they fire on. */
export type ProjectSignals = {
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  rate_band: string | null
  rate_band_weight: number

  sig_live_overrun: boolean
  live_overrun_tasks: number
  live_overrun_hours: number
  live_overrun_recent_tasks: number

  sig_approaching: boolean
  approaching_tasks: number
  approaching_hours: number

  sig_second_qa_round: boolean
  second_qa_tasks: number
  second_qa_hours: number

  sig_stuck: boolean
  stuck_tasks: number
  stuck_hours: number
  stuck_estimate_hours: number

  sig_spinning: boolean
  hours_recent_4wk: number
  completions_recent_30d: number
  last_completion_on: string | null

  sig_backlog_estimation_debt: boolean
  backlog_net_growth_6wk: number
  open_estimated_runway_hours: number
  runway_weeks: number | null

  /** NULL on Jira projects — they carry no billable_status (§4.4 "untagged"). */
  sig_writeoff_drift: boolean | null
  writeoff_pct: number | null
  writeoff_baseline_pct: number | null
  non_billable_hours: number

  sig_coverage_decay: boolean
  recent_adoption_pct: number | null
  prior_adoption_pct: number | null
  recent_unestimated_hours: number
}

export type RadarQueueRow = ProjectSignals & {
  /** Σ hours-at-risk over the FIRING signals — the explainable part. */
  exposure_hours: number
  /** … × rate-band weight. §5: internal ordering only, never rendered. */
  exposure_score: number
  firing_signal_count: number
}

const SIGNAL_COLUMNS = [
  'project_id', 'project_name', 'source', 'work_model', 'rate_band', 'rate_band_weight',
  'sig_live_overrun', 'live_overrun_tasks', 'live_overrun_hours', 'live_overrun_recent_tasks',
  'sig_approaching', 'approaching_tasks', 'approaching_hours',
  'sig_second_qa_round', 'second_qa_tasks', 'second_qa_hours',
  'sig_stuck', 'stuck_tasks', 'stuck_hours', 'stuck_estimate_hours',
  'sig_spinning', 'hours_recent_4wk', 'completions_recent_30d', 'last_completion_on',
  'sig_backlog_estimation_debt', 'backlog_net_growth_6wk', 'open_estimated_runway_hours', 'runway_weeks',
  'sig_writeoff_drift', 'writeoff_pct', 'writeoff_baseline_pct', 'non_billable_hours',
  'sig_coverage_decay', 'recent_adoption_pct', 'prior_adoption_pct', 'recent_unestimated_hours',
].join(', ')

/**
 * Coerce every numeric column exactly once, at the edge.
 *
 * The queue's copy renders some of these through `.toFixed()`, and a value
 * arriving as a string instead of a number would throw inside render and take
 * the whole landing page down rather than degrading one row. Cheap insurance
 * on the one page that has to be up every morning.
 */
function normalizeSignals(s: Record<string, unknown>): ProjectSignals {
  const num = (v: unknown): number => Number(v ?? 0)
  const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))
  const boolOrNull = (v: unknown): boolean | null => (v == null ? null : Boolean(v))
  return {
    project_id: num(s.project_id),
    project_name: String(s.project_name ?? ''),
    source: (s.source as string | null) ?? null,
    work_model: String(s.work_model ?? 'unclassified'),
    rate_band: (s.rate_band as string | null) ?? null,
    rate_band_weight: num(s.rate_band_weight),

    sig_live_overrun: Boolean(s.sig_live_overrun),
    live_overrun_tasks: num(s.live_overrun_tasks),
    live_overrun_hours: num(s.live_overrun_hours),
    live_overrun_recent_tasks: num(s.live_overrun_recent_tasks),

    sig_approaching: Boolean(s.sig_approaching),
    approaching_tasks: num(s.approaching_tasks),
    approaching_hours: num(s.approaching_hours),

    sig_second_qa_round: Boolean(s.sig_second_qa_round),
    second_qa_tasks: num(s.second_qa_tasks),
    second_qa_hours: num(s.second_qa_hours),

    sig_stuck: Boolean(s.sig_stuck),
    stuck_tasks: num(s.stuck_tasks),
    stuck_hours: num(s.stuck_hours),
    stuck_estimate_hours: num(s.stuck_estimate_hours),

    sig_spinning: Boolean(s.sig_spinning),
    hours_recent_4wk: num(s.hours_recent_4wk),
    completions_recent_30d: num(s.completions_recent_30d),
    last_completion_on: (s.last_completion_on as string | null) ?? null,

    sig_backlog_estimation_debt: Boolean(s.sig_backlog_estimation_debt),
    backlog_net_growth_6wk: num(s.backlog_net_growth_6wk),
    open_estimated_runway_hours: num(s.open_estimated_runway_hours),
    runway_weeks: numOrNull(s.runway_weeks),

    // NULL, not false, on Jira projects — they carry no billable_status, so
    // "did write-off drift?" is unanswerable rather than answered "no".
    sig_writeoff_drift: boolOrNull(s.sig_writeoff_drift),
    writeoff_pct: numOrNull(s.writeoff_pct),
    writeoff_baseline_pct: numOrNull(s.writeoff_baseline_pct),
    non_billable_hours: num(s.non_billable_hours),

    sig_coverage_decay: Boolean(s.sig_coverage_decay),
    recent_adoption_pct: numOrNull(s.recent_adoption_pct),
    prior_adoption_pct: numOrNull(s.prior_adoption_pct),
    recent_unestimated_hours: num(s.recent_unestimated_hours),
  }
}

/**
 * The attention queue: every in-scope project with at least one firing signal,
 * ranked by §5 exposure.
 *
 * Ordering is server-side and fully deterministic — score, then the raw hours,
 * then the id. §4.1's whole argument for rate bands is that ranking must not
 * collapse to signal count, so the sort key is never `firing_signal_count`.
 */
export async function fetchRadarQueue(): Promise<RadarQueueRow[]> {
  const exposure = await supabase
    .from('v_metric_exposure')
    .select('project_id, exposure_hours, exposure_score, firing_signal_count')
    .gt('firing_signal_count', 0)
    .order('exposure_score', { ascending: false })
    .order('exposure_hours', { ascending: false })
    .order('project_id', { ascending: true })
  if (exposure.error) throw exposure.error

  const ranked = (exposure.data ?? []) as Array<{
    project_id: number; exposure_hours: number; exposure_score: number; firing_signal_count: number
  }>
  if (ranked.length === 0) return []

  const signals = await supabase
    .from('v_metric_project_signals')
    .select(SIGNAL_COLUMNS)
    .in('project_id', ranked.map((r) => r.project_id))
  if (signals.error) throw signals.error

  const byId = new Map(
    ((signals.data ?? []) as unknown as Record<string, unknown>[])
      .map(normalizeSignals)
      .map((s) => [s.project_id, s]),
  )

  const rows: RadarQueueRow[] = []
  for (const r of ranked) {
    const s = byId.get(r.project_id)
    if (!s) continue
    rows.push({
      ...s,
      exposure_hours: Number(r.exposure_hours),
      exposure_score: Number(r.exposure_score),
      firing_signal_count: Number(r.firing_signal_count),
    })
  }
  return rows
}

/** A task row for the two §4.1 "bleeding now" lists. */
export type BleedingTask = {
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
  assignee_id: number | null
  estimate_hours: number
  actual_hours: number
  /** actual − estimate, > 0 only on the burning list. */
  overrun_live_hours: number
  /** actual ÷ estimate. 0.8–1.0 on the approaching list. */
  consumption: number | null
  rate_band: string | null
  rate_band_weight: number
  last_time_on: string | null
  days_since_time: number | null
  has_recent_time: boolean
}

const BLEEDING_COLUMNS =
  'task_id, task_name, project_id, project_name, source, task_jira_key, project_jira_key, ' +
  'assignee_id, estimate_hours, actual_hours, overrun_live_hours, consumption, ' +
  'rate_band, rate_band_weight, last_time_on, days_since_time, has_recent_time'

function toBleedingTask(t: Record<string, unknown>): BleedingTask {
  return {
    task_id: Number(t.task_id),
    task_name: String(t.task_name ?? ''),
    project_id: Number(t.project_id),
    project_name: String(t.project_name ?? ''),
    source: (t.source as string | null) ?? null,
    task_jira_key: (t.task_jira_key as string | null) ?? null,
    project_jira_key: (t.project_jira_key as string | null) ?? null,
    assignee_id: t.assignee_id == null ? null : Number(t.assignee_id),
    estimate_hours: Number(t.estimate_hours ?? 0),
    actual_hours: Number(t.actual_hours ?? 0),
    overrun_live_hours: Number(t.overrun_live_hours ?? 0),
    consumption: t.consumption == null ? null : Number(t.consumption),
    rate_band: (t.rate_band as string | null) ?? null,
    rate_band_weight: Number(t.rate_band_weight ?? 1),
    last_time_on: (t.last_time_on as string | null) ?? null,
    days_since_time: t.days_since_time == null ? null : Number(t.days_since_time),
    has_recent_time: Boolean(t.has_recent_time),
  }
}

/**
 * §4.1 "Bleeding now", list 1 — open tasks already past estimate *and* still
 * burning (time inside `v_metric_config.stale_days`). §1.2 ranks this the
 * strongest early-warning signal and calls the recently-active subset "the
 * actionable core"; the idle remainder is the Stuck signal's job, not this
 * list's, so the recency filter is deliberate.
 */
export async function fetchBurningTasks(): Promise<BleedingTask[]> {
  const { data, error } = await supabase
    .from('v_metric_tasks')
    .select(BLEEDING_COLUMNS)
    .eq('is_live_overrun', true)
    .eq('has_recent_time', true)
    .order('overrun_live_hours', { ascending: false })
    .order('task_id', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toBleedingTask)
}

/**
 * §4.1 "Bleeding now", list 2 — open tasks at 80–100% of estimate, not yet
 * over. §1.2: 80% consumption buys actionable lead time on roughly half of
 * overruns (post-crossing tail median 4 days).
 */
export async function fetchApproachingTasks(): Promise<BleedingTask[]> {
  const { data, error } = await supabase
    .from('v_metric_tasks')
    .select(BLEEDING_COLUMNS)
    .eq('is_approaching', true)
    .order('actual_hours', { ascending: false })
    .order('task_id', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toBleedingTask)
}

/** (project_id, month) hours — the queue's per-project sparkline. */
export type ProjectMonthHours = { project_id: number; month: string; hours: number }

export async function fetchProjectMonthHours(months: number): Promise<ProjectMonthHours[]> {
  const { data, error } = await supabase
    .from('v_metric_project_month')
    .select('project_id, month, total_hours')
    .gte('month', firstOfMonthsAgo(months - 1))
    .order('month', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Array<{ project_id: number; month: string; total_hours: number }>).map((r) => ({
    project_id: r.project_id,
    month: r.month,
    hours: Number(r.total_hours),
  }))
}

/** First day of the month `n` months before the current one, as `YYYY-MM-DD`. */
export function firstOfMonthsAgo(n: number): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1))
  return d.toISOString().slice(0, 10)
}

/** The trailing `n` month-starts, oldest first — the axis both trends share. */
export function monthAxis(n: number): string[] {
  return Array.from({ length: n }, (_, i) => firstOfMonthsAgo(n - 1 - i))
}

export type VitalMonth = {
  month: string
  logged_hours: number
  active_loggers: number
  /** Hours-weighted coverage, estimating segments only (§4.1). */
  coverage_pct: number | null
}

export type CompanyVitals = {
  months: VitalMonth[]
  /**
   * The month in progress, `YYYY-MM-01`. Named rather than inferred from the
   * array's tail: on a quiet 1st-of-the-month the newest row present is the
   * *previous* month, and treating it as partial would drop a complete month
   * off every headline.
   */
  current_month: string
  /**
   * §4.1 asks for a write-off trend tile. No monthly write-off view exists
   * (v_metric_writeoff_by_* is all-time), so the tile ships as a current
   * value with its scope split and no sparkline — see docs/progress-log.md.
   */
  writeoff_pct_in_scope: number | null
  writeoff_pct_company: number | null
  untagged_hours_in_scope: number
}

/**
 * The four §4.1 vitals, monthly. R8's period aggregates are the only canonical
 * grain that reaches back far enough, so the sparklines are per-month, not the
 * per-week the plan sketches (see the F3 deviation note).
 */
export async function fetchCompanyVitals(months: number): Promise<CompanyVitals> {
  const since = firstOfMonthsAgo(months - 1)

  const [projectMonths, personMonths, writeoff, summary] = await Promise.all([
    supabase
      .from('v_metric_project_month')
      .select('month, work_model, total_hours, hours_on_estimated')
      .gte('month', since),
    supabase
      .from('v_metric_person_month')
      .select('month, user_id, total_hours')
      .gte('month', since)
      .gt('total_hours', 0),
    supabase
      .from('v_metric_writeoff_by_segment')
      .select('is_in_scope, untagged_hours')
      .eq('is_in_scope', true),
    supabase
      .from('v_metric_scope_summary')
      .select('writeoff_pct_in_scope, writeoff_pct_company')
      .single(),
  ])
  if (projectMonths.error) throw projectMonths.error
  if (personMonths.error) throw personMonths.error
  if (writeoff.error) throw writeoff.error
  if (summary.error) throw summary.error

  type Acc = { hours: number; estHours: number; estSegHours: number; loggers: Set<number> }
  const byMonth = new Map<string, Acc>()
  const bucket = (m: string): Acc => {
    let a = byMonth.get(m)
    if (!a) {
      a = { hours: 0, estHours: 0, estSegHours: 0, loggers: new Set() }
      byMonth.set(m, a)
    }
    return a
  }

  for (const r of (projectMonths.data ?? []) as Array<{
    month: string; work_model: string; total_hours: number; hours_on_estimated: number
  }>) {
    const a = bucket(r.month)
    a.hours += Number(r.total_hours)
    // §4.1: coverage of active work, "estimating segments only". T&M and
    // internal projects have no estimates by design and would drag the line.
    if (r.work_model === 'fixed_scope' || r.work_model === 'maintenance') {
      a.estSegHours += Number(r.total_hours)
      a.estHours += Number(r.hours_on_estimated)
    }
  }
  for (const r of (personMonths.data ?? []) as Array<{ month: string; user_id: number }>) {
    bucket(r.month).loggers.add(r.user_id)
  }

  const monthRows: VitalMonth[] = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, a]) => ({
      month,
      logged_hours: a.hours,
      active_loggers: a.loggers.size,
      coverage_pct: a.estSegHours > 0 ? (a.estHours / a.estSegHours) * 100 : null,
    }))

  const s = summary.data as { writeoff_pct_in_scope: number | null; writeoff_pct_company: number | null }
  const untagged = ((writeoff.data ?? []) as Array<{ untagged_hours: number }>)
    .reduce((sum, r) => sum + Number(r.untagged_hours ?? 0), 0)

  return {
    months: monthRows,
    current_month: firstOfMonthsAgo(0),
    writeoff_pct_in_scope: s?.writeoff_pct_in_scope == null ? null : Number(s.writeoff_pct_in_scope),
    writeoff_pct_company: s?.writeoff_pct_company == null ? null : Number(s.writeoff_pct_company),
    untagged_hours_in_scope: untagged,
  }
}

/**
 * §9 keeps the classification loop closed: "the Radar shows 'untagged
 * projects' as its own alarm". An in-scope project with recent hours and no
 * work-model tag ranks at the lowest band and sits outside the estimating
 * segments, so its signals under-read until someone tags it.
 */
export async function fetchUntaggedActiveProjects(): Promise<number> {
  const { count, error } = await supabase
    .from('v_metric_project_signals')
    .select('project_id', { count: 'exact', head: true })
    .eq('work_model', 'unclassified')
    .gt('hours_recent_4wk', 0)
  if (error) throw error
  return count ?? 0
}

/**
 * id → display name for a known set of ids. Unlike `fetchUsers` this applies
 * no archived/role filter: an assignee who has since left still has to render
 * with their name on a live task row, not as "unassigned".
 */
export async function fetchUserNames(ids: number[]): Promise<Map<number, string>> {
  const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id))))
  if (unique.length === 0) return new Map()
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', unique)
  if (error) throw error
  return new Map(
    ((data ?? []) as Array<{ id: number; display_name: string | null }>).map((u) => [
      u.id,
      u.display_name ?? `#${u.id}`,
    ]),
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * §4.2 Estimation — "Is our work priced, and are the prices right?"
 *
 * SCOPE. Every fetcher below is restricted to the **estimating segments**
 * (`fixed_scope` + `maintenance`), because §4.2 opens by saying so: T&M and
 * internal work carries no estimates *by design*, and blending it into a
 * coverage average manufactures a problem that isn't one. The restriction is
 * always expressed as a filter on a canonical column — `is_estimating_segment`
 * where the view exposes it, `work_model` where it exposes that instead —
 * never re-derived here.
 *
 * GRAIN. There is no period switcher (see the F4 decision in the progress log):
 * the coverage trend and the calibration trend each own their window, and every
 * table is the all-time canonical figure over the 2025-01-01 task floor. That
 * is exactly the grain `docs/parity-report.md` pins, which is what makes the
 * page checkable against it.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The two §5 segments where an estimate is part of the deal. */
export const ESTIMATING_SEGMENTS = ['fixed_scope', 'maintenance'] as const

/**
 * PostgREST caps a response at 1000 rows. Every list on this page is well
 * under that today (629 calibration tasks, 765 unassigned, 291 overruns), but
 * "well under today" is exactly how the archive-pagination and time-record
 * pagination bugs happened on the backend. Walk pages until one comes back
 * short.
 */
async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await build(offset, offset + PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all
}

export type SegmentCoverage = {
  work_model: string
  tasks: number
  estimated_tasks: number
  adoption_pct: number | null
  hours: number
  estimated_hours: number
  unestimated_hours: number
  coverage_pct: number | null
}

/**
 * §5 coverage + adoption, per estimating segment. Two rows today
 * (maintenance / fixed_scope); the page sums them for its headline and shows
 * the split beside it, because §5's rule is "segment or lie".
 */
export async function fetchCoverageBySegment(): Promise<SegmentCoverage[]> {
  const { data, error } = await supabase
    .from('v_metric_coverage_by_segment')
    .select('work_model, tasks, estimated_tasks, adoption_pct, hours, estimated_hours, unestimated_hours, coverage_pct')
    .eq('is_estimating_segment', true)
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    work_model: String(r.work_model ?? 'unclassified'),
    tasks: Number(r.tasks ?? 0),
    estimated_tasks: Number(r.estimated_tasks ?? 0),
    adoption_pct: r.adoption_pct == null ? null : Number(r.adoption_pct),
    hours: Number(r.hours ?? 0),
    estimated_hours: Number(r.estimated_hours ?? 0),
    unestimated_hours: Number(r.unestimated_hours ?? 0),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
  }))
}

export type CoverageMonth = {
  month: string
  hours: number
  estimated_hours: number
  unestimated_hours: number
  coverage_pct: number | null
}

/**
 * §4.2's headline trend — unestimated hours per month, with the coverage line
 * over it. R8's `v_metric_project_month` is grained on **record date**, so a
 * month's bar is the hours actually logged that month; the estimated/
 * unestimated split is the task's current flag. Same basis as Radar's coverage
 * vitals tile, deliberately: two coverage lines on one product must not be
 * computed two ways.
 *
 * Every month since the tracking floor, not a trailing window: the story §4.2
 * tells is "71% of our effort is unpriced", and truncating the history would
 * hide the 2025 baseline the 2026 recovery is measured against.
 */
export async function fetchCoverageTrend(): Promise<CoverageMonth[]> {
  const rows = await fetchAllPages<{
    month: string
    total_hours: number
    hours_on_estimated: number
    hours_on_unestimated: number
  }>((from, to) =>
    supabase
      .from('v_metric_project_month')
      .select('month, total_hours, hours_on_estimated, hours_on_unestimated')
      .in('work_model', ESTIMATING_SEGMENTS)
      .order('month', { ascending: true })
      .range(from, to),
  )

  const byMonth = new Map<string, { hours: number; est: number; unest: number }>()
  for (const r of rows) {
    const key = String(r.month).slice(0, 10)
    const acc = byMonth.get(key) ?? { hours: 0, est: 0, unest: 0 }
    acc.hours += Number(r.total_hours ?? 0)
    acc.est += Number(r.hours_on_estimated ?? 0)
    acc.unest += Number(r.hours_on_unestimated ?? 0)
    byMonth.set(key, acc)
  }

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, a]) => ({
      month,
      hours: a.hours,
      estimated_hours: a.est,
      unestimated_hours: a.unest,
      coverage_pct: a.hours > 0 ? (a.est / a.hours) * 100 : null,
    }))
}

export type ProjectCoverageRow = {
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  rate_band: string | null
  tasks: number
  estimated_tasks: number
  adoption_pct: number | null
  hours: number
  unestimated_hours: number
  coverage_pct: number | null
}

/** §4.2's per-project hours-weighted coverage table. */
export async function fetchCoverageByProject(): Promise<ProjectCoverageRow[]> {
  const { data, error } = await supabase
    .from('v_metric_coverage_by_project')
    .select('project_id, project_name, source, work_model, rate_band, tasks, estimated_tasks, adoption_pct, hours, unestimated_hours, coverage_pct')
    .eq('is_estimating_segment', true)
    .order('unestimated_hours', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    source: (r.source as string | null) ?? null,
    work_model: String(r.work_model ?? 'unclassified'),
    rate_band: (r.rate_band as string | null) ?? null,
    tasks: Number(r.tasks ?? 0),
    estimated_tasks: Number(r.estimated_tasks ?? 0),
    adoption_pct: r.adoption_pct == null ? null : Number(r.adoption_pct),
    hours: Number(r.hours ?? 0),
    unestimated_hours: Number(r.unestimated_hours ?? 0),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
  }))
}

export type PersonCoverageRow = {
  user_id: number
  display_name: string
  tasks: number
  hours: number
  unestimated_hours: number
  coverage_pct: number | null
}

/**
 * §4.2's per-person unestimated-hours list, "within estimating projects only".
 *
 * Hours-weighted off the contributor grain, per §1.3 ("hours-weighted
 * per-person unestimated work beats task-count adoption") — so this is *whose
 * hours went onto unpriced work*, not whose name is on the task. It is not the
 * §5 attribution rule and must never be labelled as blame for an estimate;
 * that distinction is the whole point of §1.6's withdrawn Kotsan finding.
 *
 * Identities are already merged: `v_metric_coverage_by_person` reads through
 * `v_metric_task_contributors`, which keys on the canonical id (R6).
 */
export async function fetchUnestimatedByPerson(): Promise<PersonCoverageRow[]> {
  const { data, error } = await supabase
    .from('v_metric_coverage_by_person')
    .select('user_id, display_name, tasks, hours, unestimated_hours, coverage_pct')
    .eq('is_estimating_segment', true)
    .order('unestimated_hours', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    user_id: Number(r.user_id),
    display_name: String(r.display_name ?? `#${r.user_id}`),
    tasks: Number(r.tasks ?? 0),
    hours: Number(r.hours ?? 0),
    unestimated_hours: Number(r.unestimated_hours ?? 0),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
  }))
}

export type UnassignedBucket = {
  tasks: number
  hours: number
  unestimated_hours: number
}

/**
 * §4.2 wants the Unassigned bucket "as a first-class row", from §1.3's
 * accountability limit: 16% of in-scope tasks have no assignee at all, so for
 * that share of the work there is nobody to ask about the missing estimate.
 *
 * It is deliberately *not* a row in the per-person list above: that list is
 * grained on who logged the hours, and an unassigned task's hours are already
 * counted there under whoever worked it. This is a second, orthogonal fact
 * about ownership, and merging the two would double-count the hours.
 */
export async function fetchUnassignedBucket(): Promise<UnassignedBucket> {
  const rows = await fetchAllPages<{ actual_hours: number; is_estimated: boolean }>((from, to) =>
    supabase
      .from('v_metric_tasks')
      .select('task_id, actual_hours, is_estimated')
      .eq('is_estimating_segment', true)
      .is('assignee_id', null)
      .order('task_id', { ascending: true })
      .range(from, to),
  )
  let hours = 0
  let unestimated = 0
  for (const r of rows) {
    const h = Number(r.actual_hours ?? 0)
    hours += h
    if (!r.is_estimated) unestimated += h
  }
  return { tasks: rows.length, hours, unestimated_hours: unestimated }
}

/**
 * One completed, estimated, actually-tracked task — the §5 calibration sample.
 *
 * The whole calibration block is built from this one fetch: the histogram, the
 * quarterly trend, the by-estimate-size cut and the AC-vs-Jira benchmark are
 * four cuts of the same rows, so they cannot disagree with each other. Only
 * the *bucketing* happens on the client; every predicate on the row
 * (`is_calibration_sample`, `is_in_band`, `is_exact_match`, `ratio`) is
 * supplied by `v_metric_tasks`, per §2.3's "the frontend must never re-derive
 * these predicates".
 */
export type CalibrationTask = {
  task_id: number
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  estimate_hours: number
  actual_hours: number
  ratio: number
  completed_on: string | null
  is_in_band: boolean
  is_exact_match: boolean
}

export async function fetchCalibrationSample(): Promise<CalibrationTask[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_metric_tasks')
      .select('task_id, project_id, project_name, source, work_model, estimate_hours, actual_hours, ratio, completed_on, is_in_band, is_exact_match')
      .eq('is_estimating_segment', true)
      .eq('is_calibration_sample', true)
      .order('task_id', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    task_id: Number(r.task_id),
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    source: (r.source as string | null) ?? null,
    work_model: String(r.work_model ?? 'unclassified'),
    estimate_hours: Number(r.estimate_hours ?? 0),
    actual_hours: Number(r.actual_hours ?? 0),
    ratio: Number(r.ratio ?? 0),
    completed_on: (r.completed_on as string | null) ?? null,
    is_in_band: Boolean(r.is_in_band),
    is_exact_match: Boolean(r.is_exact_match),
  }))
}

/**
 * §5's "estimated, never tracked" — completed estimated tasks with zero actual
 * hours. Excluded from the calibration sample on purpose (a 0/8 ratio is not a
 * 100% underrun, it is missing data), and reported beside it so the two
 * "accuracy" numbers §1.5.5 describes can never disagree again.
 */
export type ZeroTracked = { tasks: number; estimate_hours: number }

export async function fetchZeroTracked(): Promise<ZeroTracked> {
  const { data, error } = await supabase
    .from('v_metric_calibration_by_segment')
    .select('zero_tracked_tasks, zero_tracked_estimate_hours')
    .eq('is_estimating_segment', true)
  if (error) throw error
  const rows = (data ?? []) as Array<{ zero_tracked_tasks: number; zero_tracked_estimate_hours: number }>
  return {
    tasks: rows.reduce((s, r) => s + Number(r.zero_tracked_tasks ?? 0), 0),
    estimate_hours: rows.reduce((s, r) => s + Number(r.zero_tracked_estimate_hours ?? 0), 0),
  }
}

export type PersonOverrunRow = {
  user_id: number
  display_name: string
  realized_overrun_tasks: number
  realized_overrun_hours: number
}

/**
 * Realized overrun per person under the **§5 attribution rule** — the top
 * contributor at ≥ 40% of a task's hours, ties left unattributed. Never the
 * assignee of record.
 *
 * `v_metric_overrun_by_person` is grained in-scope-wide with no segment
 * column. That is not a scope leak here: the excluded segments (`tm_outstaff`,
 * `unclassified`) hold **zero estimated tasks**, so they contribute no overrun
 * at all — the page footnotes this rather than filtering a column the view
 * does not expose.
 */
export async function fetchRealizedOverrunByPerson(): Promise<PersonOverrunRow[]> {
  const { data, error } = await supabase
    .from('v_metric_overrun_by_person')
    .select('user_id, display_name, realized_overrun_tasks, realized_overrun_hours')
    .gt('realized_overrun_hours', 0)
    .order('realized_overrun_hours', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    user_id: Number(r.user_id),
    display_name: String(r.display_name ?? `#${r.user_id}`),
    realized_overrun_tasks: Number(r.realized_overrun_tasks ?? 0),
    realized_overrun_hours: Number(r.realized_overrun_hours ?? 0),
  }))
}

export type BlowoutTask = {
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  source: string | null
  task_jira_key: string | null
  work_model: string
  rate_band: string | null
  estimate_hours: number
  actual_hours: number
  overrun_hours: number
  ratio: number | null
  completed_on: string | null
}

/**
 * Every completed estimated task that finished over its estimate, biggest
 * excess first.
 *
 * §4.2 asks for "the top-30 blowout queue (42% of overrun hours)". The whole
 * distribution is fetched rather than `LIMIT 30` so the page can *show* that
 * concentration instead of asserting it — the top-10 and top-30 shares are
 * computed against the same rows the table is drawn from, so a reader can
 * audit the claim from what is on screen.
 */
export async function fetchRealizedOverrunTasks(): Promise<BlowoutTask[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_metric_tasks')
      .select('task_id, task_name, project_id, project_name, source, task_jira_key, work_model, rate_band, estimate_hours, actual_hours, overrun_realized_hours, ratio, completed_on')
      .eq('is_estimating_segment', true)
      .eq('is_completed', true)
      .eq('is_estimated', true)
      .gt('overrun_realized_hours', 0)
      .order('overrun_realized_hours', { ascending: false })
      .order('task_id', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    task_id: Number(r.task_id),
    task_name: String(r.task_name ?? ''),
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    source: (r.source as string | null) ?? null,
    task_jira_key: (r.task_jira_key as string | null) ?? null,
    work_model: String(r.work_model ?? 'unclassified'),
    rate_band: (r.rate_band as string | null) ?? null,
    estimate_hours: Number(r.estimate_hours ?? 0),
    actual_hours: Number(r.actual_hours ?? 0),
    overrun_hours: Number(r.overrun_realized_hours ?? 0),
    ratio: r.ratio == null ? null : Number(r.ratio),
    completed_on: (r.completed_on as string | null) ?? null,
  }))
}

/**
 * `v_metric_config` — the one row every threshold lives in (§4.1).
 *
 * The page reads it so that a rollup computed in the browser still compares
 * against the database's number rather than a literal. That matters here
 * because F4's load-shape repair moved the per-project calibration rollup
 * client-side: the *aggregation* moved, the *threshold* did not.
 *
 * Free to query — the view is a single row of constants with no dependency on
 * `v_metric_tasks`, so it costs nothing next to the rollups it replaces.
 */
export type MetricConfig = { exact_match_flag_pct: number; person_min_sample: number }

export async function fetchMetricConfig(): Promise<MetricConfig> {
  const { data, error } = await supabase
    .from('v_metric_config')
    .select('exact_match_flag_pct, person_min_sample')
    .single()
  if (error) throw error
  const row = data as { exact_match_flag_pct: number | null; person_min_sample: number | null }
  return {
    exact_match_flag_pct: Number(row?.exact_match_flag_pct ?? 40),
    // §4.5's suppression floor. Read from the database for the same reason the
    // exact-match threshold is: the People page decides what NOT to show from
    // it, and a literal here would drift away from `meets_sample_floor`.
    person_min_sample: Number(row?.person_min_sample ?? 10),
  }
}
