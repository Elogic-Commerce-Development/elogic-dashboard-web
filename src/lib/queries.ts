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

export type ProjectListItem = { id: number; name: string }
export type UserListItem = { id: number; display_name: string }

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
  let q = supabase
    .from('v_task_actual_vs_estimate')
    .select('*')
    .order('created_on', { ascending: false })

  if (projectIds.length > 0) q = q.in('project_id', projectIds)
  if (userIds.length > 0) q = q.in('assignee_id', userIds)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
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
    .select('id, name')
    .eq('is_trashed', false)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProjectListItem[]
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

export async function fetchContributorTaskSummary(contributorId: number): Promise<ContributorTaskSummary[]> {
  const { data, error } = await supabase
    .from('v_contributor_task_summary')
    .select('*')
    .eq('contributor_id', contributorId)
    .order('created_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContributorTaskSummary[]
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
