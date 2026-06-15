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

export type ProjectStats = {
  project_id: number
  project_name: string
  tasks_with_time: number
  unestimated_tasks: number
  overrun_tasks: number
  total_hours: number
  hours_on_unestimated: number
  hours_on_overrun: number
  team_members: number
  avg_qa_bugs: number | null
  qa_bugs_tasks: number
  avg_qa_iterations: number | null
  qa_iterations_tasks: number
  /** Project completion flag — Projects grid defaults to active (false). */
  is_completed: boolean
  source: string | null
  jira_key: string | null
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

/**
 * user_id → class map for ALL users (no archive/role filter), so period-mode
 * aggregation can drop non-team contributors the same way the all-time
 * v_contributor_stats query does. Walks pages past the 1000-row cap.
 */
export async function fetchUserClassMap(): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>()
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('users')
      .select('id, class')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as { id: number; class: string | null }[]
    for (const r of rows) map.set(r.id, r.class)
    if (rows.length < PAGE) break
  }
  return map
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

/**
 * IDs of the Jira-sourced projects (PSP). Unioned with the outsourcing scope so
 * PSP appears on the dashboard the same way AC outsourcing projects do.
 */
export async function fetchJiraProjectIds(): Promise<number[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('source', 'jira')
    .eq('is_trashed', false)
  if (error) throw error
  return (data ?? []).map((p) => p.id)
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

export async function fetchGlobalKpis(): Promise<GlobalKpis | null> {
  const { data, error } = await supabase.from('v_global_kpis').select('*').maybeSingle()
  if (error) throw error
  return (data as GlobalKpis | null) ?? null
}

export async function fetchContributorStats(userIds: number[] = []): Promise<ContributorStats[]> {
  let q = supabase
    .from('v_contributor_stats')
    .select('*')
    .in('class', TEAM_ROLES) // People grid: Owner/Member only, drop Client/Client+
    .order('total_hours', { ascending: false })
  if (userIds.length > 0) q = q.in('contributor_id', userIds)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ContributorStats[]
}

export async function fetchProjectStats(projectIds: number[] = []): Promise<ProjectStats[]> {
  let q = supabase
    .from('v_project_stats')
    .select('*')
    .order('total_hours', { ascending: false })
  if (projectIds.length > 0) q = q.in('project_id', projectIds)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ProjectStats[]
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
