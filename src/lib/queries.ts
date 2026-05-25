import { supabase } from './supabase'
import type { Filters } from './filters'

export type TaskWithoutEstimate = {
  id: number
  name: string
  project_id: number
  project_name: string
  assignee_id: number | null
  assignee_name: string | null
  created_on: string
  due_on: string | null
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
}

export type EstimateAccuracyByUser = {
  assignee_id: number | null
  assignee_name: string | null
  estimated_tasks: number
  total_tasks: number
  mean_ratio: number | null
  median_ratio: number | null
}

export type EstimateAccuracyByProject = {
  project_id: number
  project_name: string
  estimated_tasks: number
  total_tasks: number
  mean_ratio: number | null
  median_ratio: number | null
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
  mean_ratio: number | null
  median_ratio: number | null
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

export type RecentUnestimated = {
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  recent_hours: number
  total_hours: number
  last_record_date: string
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
}

export type ProjectListItem = { id: number; name: string; label_id: number | null }
export type UserListItem = { id: number; display_name: string }

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

export async function fetchTasksWithoutEstimates(filters: Filters): Promise<TaskWithoutEstimate[]> {
  let q = supabase
    .from('v_tasks_without_estimates')
    .select('*')
    .order('created_on', { ascending: false })
    .limit(500)

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
  if (filters.from) q = q.gte('created_on', filters.from)
  if (filters.to) q = q.lte('created_on', filters.to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskWithoutEstimate[]
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
  if (filters.to) q = q.lte('created_on', filters.to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchAllTasksFiltered(projectIds: number[], userIds: number[]): Promise<TaskActualVsEstimate[]> {
  // PostgREST caps each response at 1000 rows by default. The outsourcing
  // scope can exceed that, so walk pages until we get a short page. Same
  // pattern as fetchMonthlyTrendFiltered below.
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
  if (filters.to) q = q.lte('created_on', filters.to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchAccuracyByUser(filters: Filters): Promise<EstimateAccuracyByUser[]> {
  let q = supabase
    .from('v_estimate_accuracy_by_user')
    .select('*')
    .order('estimated_tasks', { ascending: false })

  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as EstimateAccuracyByUser[]
}

export async function fetchAccuracyByProject(filters: Filters): Promise<EstimateAccuracyByProject[]> {
  let q = supabase
    .from('v_estimate_accuracy_by_project')
    .select('*')
    .order('estimated_tasks', { ascending: false })

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as EstimateAccuracyByProject[]
}

export async function fetchSyncStatus(): Promise<SyncStatusRow | null> {
  const { data, error } = await supabase.from('v_sync_status').select('*').maybeSingle()
  if (error) throw error
  return (data as SyncStatusRow | null) ?? null
}

export async function fetchProjects(): Promise<ProjectListItem[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, label_id')
    .eq('is_trashed', false)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProjectListItem[]
}

/**
 * Returns the IDs of projects labeled "OUTSOURCING PROJECT".
 * The dashboard is scoped to these projects only.
 */
export async function fetchOutsourcingProjectIds(): Promise<number[]> {
  // First find the label ID (name has a leading space in AC data, so use ilike)
  const { data: labels, error: labelsErr } = await supabase
    .from('labels')
    .select('id')
    .ilike('name', '%OUTSOURCING PROJECT%')
    .eq('scope', 'project')
    .limit(1)
  if (labelsErr) throw labelsErr
  if (!labels || labels.length === 0) return []

  const labelId = labels[0].id

  // Then find all projects with that label
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('label_id', labelId)
    .eq('is_trashed', false)
  if (projErr) throw projErr
  return (projects ?? []).map((p) => p.id)
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('is_archived', false)
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserListItem[]
}

export async function fetchGlobalKpis(): Promise<GlobalKpis | null> {
  const { data, error } = await supabase.from('v_global_kpis').select('*').maybeSingle()
  if (error) throw error
  return (data as GlobalKpis | null) ?? null
}

export async function fetchContributorStats(): Promise<ContributorStats[]> {
  const { data, error } = await supabase
    .from('v_contributor_stats')
    .select('*')
    .order('total_hours', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContributorStats[]
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
      project: { id: number; name: string } | null
    } | null
  }

  // Q1: this user's records in period with task + project embedded.
  const { data: mine, error: mineErr } = await supabase
    .from('time_records')
    .select(
      'task_id, value_hours, task:tasks(id, name, project_id, assignee_id, estimate_hours, is_completed, completed_on, created_on, project:projects(id, name))',
    )
    .eq('user_id', contributorId)
    .eq('is_trashed', false)
    .gte('record_date', from)
    .lte('record_date', to)
    .not('task_id', 'is', null)
    .limit(10000)
  if (mineErr) throw mineErr

  const myRows = (mine ?? []) as unknown as RawRow[]
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
  // "Task actual" + "Share" columns. Only one round-trip; values_hours is a
  // numeric column so the payload is small.
  const taskIds = Array.from(perTask.keys())
  const { data: allRows, error: allErr } = await supabase
    .from('time_records')
    .select('task_id, value_hours')
    .in('task_id', taskIds)
    .eq('is_trashed', false)
    .gte('record_date', from)
    .lte('record_date', to)
    .limit(50000)
  if (allErr) throw allErr

  const taskTotals = new Map<number, number>()
  for (const r of (allRows ?? []) as { task_id: number; value_hours: number }[]) {
    taskTotals.set(r.task_id, (taskTotals.get(r.task_id) ?? 0) + Number(r.value_hours))
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

export async function fetchTopUnestimatedWithTime(limit = 5): Promise<TaskActualVsEstimate[]> {
  const { data, error } = await supabase
    .from('v_task_actual_vs_estimate')
    .select('*')
    .is('estimate_hours', null)
    .gt('actual_hours', 0)
    .order('actual_hours', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchTopOverruns(limit = 5): Promise<TaskActualVsEstimate[]> {
  const { data, error } = await supabase
    .from('v_tasks_overrun')
    .select('*')
    .order('ratio', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchRecentUnestimated(limit = 5): Promise<RecentUnestimated[]> {
  const { data, error } = await supabase
    .from('v_recent_unestimated_activity')
    .select('*')
    .limit(limit)
  if (error) throw error
  return (data ?? []) as RecentUnestimated[]
}

export async function fetchRecentOverruns(limit = 5): Promise<RecentOverrun[]> {
  const { data, error } = await supabase
    .from('v_recent_overrun_activity')
    .select('*')
    .limit(limit)
  if (error) throw error
  return (data ?? []) as RecentOverrun[]
}

export async function fetchMonthlyTrend(): Promise<MonthlyTrend[]> {
  const { data, error } = await supabase
    .from('v_monthly_trend')
    .select('*')
    .order('month', { ascending: true })
  if (error) throw error
  return (data ?? []) as MonthlyTrend[]
}

type TimeRecordRow = {
  task_id: number
  value_hours: number
  record_date: string
}

/**
 * Fetch time records for filtered projects/users, then compute the monthly
 * trend client-side (mirrors the SQL in v_monthly_trend but scoped).
 */
export async function fetchMonthlyTrendFiltered(
  projectIds: number[],
  userIds: number[],
  tasks: TaskActualVsEstimate[],
): Promise<MonthlyTrend[]> {
  // Build a lookup of task-level info we already have
  const taskMap = new Map<number, TaskActualVsEstimate>()
  for (const t of tasks) taskMap.set(t.task_id, t)

  // Fetch time records scoped to the same project/user filters
  let q = supabase
    .from('time_records')
    .select('task_id, value_hours, record_date')
    .eq('is_trashed', false)
    .not('task_id', 'is', null)
  if (projectIds.length > 0) q = q.in('project_id', projectIds)
  if (userIds.length > 0) q = q.in('user_id', userIds)

  // Paginate – Supabase default limit is 1000
  const allRecords: TimeRecordRow[] = []
  const PAGE = 1000
  let offset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await q.range(offset, offset + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as TimeRecordRow[]
    allRecords.push(...rows)
    if (rows.length < PAGE) break
    offset += PAGE
  }

  // Only keep records whose task is in our filtered set
  const taskIds = new Set(taskMap.keys())
  const filtered = allRecords.filter((r) => r.task_id != null && taskIds.has(r.task_id))

  // Group by month
  const months = new Map<string, {
    hours: number
    taskHours: Map<number, number>
  }>()

  for (const r of filtered) {
    const month = r.record_date.slice(0, 7) + '-01' // "YYYY-MM-01"
    let bucket = months.get(month)
    if (!bucket) { bucket = { hours: 0, taskHours: new Map() }; months.set(month, bucket) }
    bucket.hours += Number(r.value_hours)
    bucket.taskHours.set(r.task_id, (bucket.taskHours.get(r.task_id) ?? 0) + Number(r.value_hours))
  }

  // Build per-task total hours for overrun detection (matches v_monthly_trend CTE)
  const taskTotalHours = new Map<number, number>()
  for (const r of filtered) {
    taskTotalHours.set(r.task_id, (taskTotalHours.get(r.task_id) ?? 0) + Number(r.value_hours))
  }

  // Produce MonthlyTrend rows
  const result: MonthlyTrend[] = []
  for (const [month, bucket] of Array.from(months.entries()).sort()) {
    const activeTaskIds = Array.from(bucket.taskHours.keys())
    const activeTasks = activeTaskIds.length

    let unestimatedTasks = 0
    let unestimatedHours = 0
    let overrunTasks = 0
    let overrunHours = 0
    let estimatedCount = 0

    for (const tid of activeTaskIds) {
      const t = taskMap.get(tid)
      if (!t) continue
      const monthHours = bucket.taskHours.get(tid) ?? 0
      if (t.estimate_hours == null) {
        unestimatedTasks++
        unestimatedHours += monthHours
      } else {
        estimatedCount++
        const totalActual = taskTotalHours.get(tid) ?? 0
        if (Number(t.estimate_hours) > 0 && totalActual > Number(t.estimate_hours)) {
          overrunTasks++
          overrunHours += monthHours
        }
      }
    }

    result.push({
      month,
      active_tasks: activeTasks,
      total_hours: Math.round(bucket.hours * 100) / 100,
      unestimated_tasks: unestimatedTasks,
      unestimated_hours: Math.round(unestimatedHours * 100) / 100,
      overrun_tasks: overrunTasks,
      overrun_hours: Math.round(overrunHours * 100) / 100,
      estimate_adoption_rate: activeTasks > 0 ? estimatedCount / activeTasks : null,
    })
  }

  return result
}
