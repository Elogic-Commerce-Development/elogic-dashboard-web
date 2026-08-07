import { supabase } from './supabase'
import { BACKLOG_OLD_DAYS } from './projectPolicy'

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

/* ── Canonical §5 metric layer ──────────────────────────────────────────────
 *
 * Everything below reads the `v_metric_*` family — one SQL definition per
 * metric (S3/R5) — never the legacy all-time views (whole company, back to
 * 2017, no scope filter). Grain rules inherited from F2:
 *
 *   all time        the aggregate views carry no date filter
 *   one month       R8's v_metric_{person,project}_month
 *   month ranges    S7's v_metric_task_contributor_month — hours sum exactly
 *                   (its `hours` column is deliberately unrounded) and task
 *                   counts stay exact via client-side DISTINCT task_id
 *
 * Anything finer than a calendar month has no canonical source, which is why
 * the grid and project period groups offer only month-aligned presets.
 */

/** `2026-08-01` for the calendar month a period's start date falls in. */
export function monthKey(from: string): string {
  return `${from.slice(0, 7)}-01`
}

/* ── Projects index (F6, §4.6) ────────────────────────────────────────────────
 *
 * One row per in-scope project carrying 2025+ tasks (28 today, not 65 — the
 * rest hold no in-scope tasks; see the progress log's F2 open question).
 * Two kinds of column, labeled apart on the page:
 *
 *   period-scoped   hours, coverage, team size + top-contributor share —
 *                   all-time from v_metric_coverage_by_project +
 *                   v_metric_task_contributors, one month from R8/S7.
 *   current-state   write-off % (record grain since 2025, AC only), firing
 *                   Radar signals, open-backlog hygiene — the same regardless
 *                   of the period pill, because the underlying metric owns its
 *                   own window.
 *
 * The §4.6 slim also *dropped* the task/estimated/overrun-count columns; the
 * overrun economics live on Estimation and per project on the detail page.
 */

export type ProjectIndexRow = {
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  rate_band: string | null
  is_estimating_segment: boolean
  is_completed: boolean
  /** Task-linked hours for the selected grain (all time | one month). */
  hours: number
  /** Hours-weighted estimate coverage for the grain; gate display on `is_estimating_segment`. */
  coverage_pct: number | null
}

/** Bus factor for the grain: contributor count and the top contributor's share of hours. */
export type ProjectTeamStat = { team_size: number; top_share_pct: number | null }

export async function fetchProjectsIndexAllTime(projectIds: number[]): Promise<ProjectIndexRow[]> {
  let covQ = supabase
    .from('v_metric_coverage_by_project')
    .select('project_id, project_name, source, work_model, rate_band, is_estimating_segment, hours, coverage_pct')
  if (projectIds.length > 0) covQ = covQ.in('project_id', projectIds)

  const [cov, completed] = await Promise.all([covQ, fetchProjectCompletedMap()])
  if (cov.error) throw cov.error

  return ((cov.data ?? []) as Array<{
    project_id: number; project_name: string; source: string | null; work_model: string
    rate_band: string | null; is_estimating_segment: boolean; hours: number; coverage_pct: number | null
  }>)
    .map((r) => ({
      project_id: r.project_id,
      project_name: r.project_name,
      source: r.source,
      work_model: String(r.work_model ?? 'unclassified'),
      rate_band: r.rate_band,
      is_estimating_segment: Boolean(r.is_estimating_segment),
      is_completed: completed.get(r.project_id) ?? false,
      hours: Number(r.hours),
      coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
    }))
    .sort((a, b) => b.hours - a.hours)
}

export async function fetchProjectsIndexForMonth(
  month: string,
  projectIds: number[],
): Promise<ProjectIndexRow[]> {
  let q = supabase
    .from('v_metric_project_month')
    .select('project_id, project_name, source, work_model, rate_band, project_is_completed, total_hours, coverage_pct')
    .eq('month', month)
    .order('total_hours', { ascending: false })
  if (projectIds.length > 0) q = q.in('project_id', projectIds)

  // The month view carries no `is_estimating_segment`; read the flag from the
  // coverage view rather than re-deriving §5's work-model mapping client-side.
  let segQ = supabase.from('v_metric_coverage_by_project').select('project_id, is_estimating_segment')
  if (projectIds.length > 0) segQ = segQ.in('project_id', projectIds)

  const [res, seg] = await Promise.all([q, segQ])
  if (res.error) throw res.error
  if (seg.error) throw seg.error
  const estSeg = new Map(
    ((seg.data ?? []) as Array<{ project_id: number; is_estimating_segment: boolean }>).map((r) => [
      r.project_id,
      Boolean(r.is_estimating_segment),
    ]),
  )

  return ((res.data ?? []) as Array<{
    project_id: number; project_name: string; source: string | null; work_model: string | null
    rate_band: string | null; project_is_completed: boolean; total_hours: number; coverage_pct: number | null
  }>).map((r) => ({
    project_id: r.project_id,
    project_name: r.project_name,
    source: r.source,
    work_model: String(r.work_model ?? 'unclassified'),
    rate_band: r.rate_band,
    is_estimating_segment: estSeg.get(r.project_id) ?? false,
    is_completed: Boolean(r.project_is_completed),
    hours: Number(r.total_hours),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
  }))
}

/** Write-off % per project — record grain since 2025, AC only (§4.4). Jira renders "untagged", never 0%. */
export async function fetchProjectWriteoffMap(
  projectIds: number[],
): Promise<Map<number, { pct: number | null; flagged: boolean }>> {
  let q = supabase
    .from('v_metric_writeoff_by_project')
    .select('project_id, writeoff_pct, writeoff_flagged')
    .eq('is_in_scope', true)
  if (projectIds.length > 0) q = q.in('project_id', projectIds)
  const { data, error } = await q
  if (error) throw error
  return new Map(
    ((data ?? []) as Array<{ project_id: number; writeoff_pct: number | null; writeoff_flagged: boolean | null }>).map(
      (r) => [r.project_id, { pct: r.writeoff_pct == null ? null : Number(r.writeoff_pct), flagged: Boolean(r.writeoff_flagged) }],
    ),
  )
}

/** Firing-signal count per project, from the same view Radar ranks with. Display only — never a sort default (§4.1). */
export async function fetchFiringSignalCounts(projectIds: number[]): Promise<Map<number, number>> {
  let q = supabase.from('v_metric_exposure').select('project_id, firing_signal_count')
  if (projectIds.length > 0) q = q.in('project_id', projectIds)
  const { data, error } = await q
  if (error) throw error
  return new Map(
    ((data ?? []) as Array<{ project_id: number; firing_signal_count: number }>).map((r) => [
      r.project_id,
      Number(r.firing_signal_count),
    ]),
  )
}

/** §4.6's zombie-backlog signal: open tasks now, how many are old, and the age median. */
export type ProjectBacklogStat = { open_tasks: number; open_over_180d: number; age_p50_days: number | null }

export async function fetchProjectBacklogMap(projectIds: number[]): Promise<Map<number, ProjectBacklogStat>> {
  const rows = await fetchAllPages<{ project_id: number; created_on: string }>((from, to) => {
    let q = supabase
      .from('v_scope_tasks')
      .select('project_id, created_on')
      .eq('is_completed', false)
      .order('project_id', { ascending: true })
      .order('task_id', { ascending: true })
      .range(from, to)
    if (projectIds.length > 0) q = q.in('project_id', projectIds)
    return q
  })

  const now = Date.now()
  const ages = new Map<number, number[]>()
  for (const r of rows) {
    const ageDays = (now - new Date(r.created_on).getTime()) / 86_400_000
    const list = ages.get(r.project_id)
    if (list) list.push(ageDays)
    else ages.set(r.project_id, [ageDays])
  }

  const out = new Map<number, ProjectBacklogStat>()
  for (const [pid, list] of ages) {
    list.sort((a, b) => a - b)
    out.set(pid, {
      open_tasks: list.length,
      open_over_180d: list.filter((a) => a > BACKLOG_OLD_DAYS).length,
      age_p50_days: Math.round(percentile(list, 0.5)),
    })
  }
  return out
}

/** Linear-interpolated percentile over a sorted ascending list (matches SQL `percentile_cont`). */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN
  const idx = (sortedAsc.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)
}

/** All-time bus factor per project, from the canonical contributor grain (R6-merged people). */
export async function fetchProjectTeamAllTime(projectIds: number[]): Promise<Map<number, ProjectTeamStat>> {
  const rows = await fetchAllPages<{ project_id: number; user_id: number; hours: number }>((from, to) => {
    let q = supabase
      .from('v_metric_task_contributors')
      .select('project_id, user_id, hours')
      .order('project_id', { ascending: true })
      .order('task_id', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to)
    if (projectIds.length > 0) q = q.in('project_id', projectIds)
    return q
  })
  return teamStatsFromContribRows(rows)
}

/** One-month bus factor per project, from S7's (task, person, month) grain. */
export async function fetchProjectTeamForMonth(
  month: string,
  projectIds: number[],
): Promise<Map<number, ProjectTeamStat>> {
  const rows = await fetchAllPages<{ project_id: number; user_id: number; hours: number }>((from, to) => {
    let q = supabase
      .from('v_metric_task_contributor_month')
      .select('project_id, user_id, hours')
      .eq('month', month)
      .order('project_id', { ascending: true })
      .order('task_id', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to)
    if (projectIds.length > 0) q = q.in('project_id', projectIds)
    return q
  })
  return teamStatsFromContribRows(rows)
}

function teamStatsFromContribRows(
  rows: Array<{ project_id: number; user_id: number; hours: number }>,
): Map<number, ProjectTeamStat> {
  const perProject = new Map<number, Map<number, number>>()
  for (const r of rows) {
    let people = perProject.get(r.project_id)
    if (!people) {
      people = new Map()
      perProject.set(r.project_id, people)
    }
    people.set(r.user_id, (people.get(r.user_id) ?? 0) + Number(r.hours))
  }
  const out = new Map<number, ProjectTeamStat>()
  for (const [pid, people] of perProject) {
    let total = 0
    let top = 0
    for (const h of people.values()) {
      total += h
      if (h > top) top = h
    }
    out.set(pid, {
      team_size: people.size,
      top_share_pct: total > 0 ? (top / total) * 100 : null,
    })
  }
  return out
}

/* ── Project detail (F6, §4.7) ────────────────────────────────────────────────
 *
 * The detail page's data paths, migrated off the legacy views (this was the
 * project half of F2's detail seam, folded into F6):
 *
 *   all time      v_metric_tasks + v_metric_task_contributors, per project —
 *                 every §5 predicate arrives as a view boolean; the page only
 *                 counts and sums, it never re-derives one.
 *   month range   S7's v_metric_task_contributor_month per project.
 *   history       v_metric_project_month (monthly hours/coverage/team),
 *                 v_scope_tasks (created/completed flow), v_bulk_close_days
 *                 (§5 flow-trend exclusion, annotated on the chart),
 *                 v_metric_project_signals (firing banner + runway + write-off).
 */

/** One in-scope task on the detail page — a per-project slice of `v_metric_tasks`. */
export type ProjectTaskRow = {
  task_id: number
  task_name: string
  assignee_id: number | null
  source: string | null
  task_jira_key: string | null
  created_on: string
  completed_on: string | null
  is_completed: boolean
  estimate_hours: number | null
  actual_hours: number
  is_estimated: boolean
  overrun_hours: number
  ratio: number | null
  qa_iterations: number | null
  qa_bugs: number | null
  is_bucket: boolean
  is_live_overrun: boolean
  overrun_live_hours: number
  overrun_realized_hours: number
  is_approaching: boolean
  is_stuck: boolean
}

const PROJECT_TASK_COLUMNS =
  'task_id, task_name, assignee_id, source, task_jira_key, created_on, completed_on, is_completed, ' +
  'estimate_hours, actual_hours, is_estimated, overrun_hours, ratio, qa_iterations, qa_bugs, ' +
  'is_bucket, is_live_overrun, overrun_live_hours, overrun_realized_hours, is_approaching, is_stuck'

export async function fetchProjectTasks(projectId: number): Promise<ProjectTaskRow[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_metric_tasks')
      .select(PROJECT_TASK_COLUMNS)
      .eq('project_id', projectId)
      .order('created_on', { ascending: false })
      .order('task_id', { ascending: true })
      .range(from, to),
  )
  return rows.map((t) => ({
    task_id: Number(t.task_id),
    task_name: String(t.task_name ?? ''),
    assignee_id: t.assignee_id == null ? null : Number(t.assignee_id),
    source: (t.source as string | null) ?? null,
    task_jira_key: (t.task_jira_key as string | null) ?? null,
    created_on: String(t.created_on),
    completed_on: (t.completed_on as string | null) ?? null,
    is_completed: Boolean(t.is_completed),
    estimate_hours: t.estimate_hours == null ? null : Number(t.estimate_hours),
    actual_hours: Number(t.actual_hours ?? 0),
    is_estimated: Boolean(t.is_estimated),
    overrun_hours: Number(t.overrun_hours ?? 0),
    ratio: t.ratio == null ? null : Number(t.ratio),
    qa_iterations: t.qa_iterations == null ? null : Number(t.qa_iterations),
    qa_bugs: t.qa_bugs == null ? null : Number(t.qa_bugs),
    is_bucket: Boolean(t.is_bucket),
    is_live_overrun: Boolean(t.is_live_overrun),
    overrun_live_hours: Number(t.overrun_live_hours ?? 0),
    overrun_realized_hours: Number(t.overrun_realized_hours ?? 0),
    is_approaching: Boolean(t.is_approaching),
    is_stuck: Boolean(t.is_stuck),
  }))
}

/** One (person, task) contribution — the canonical (R6-merged) contributor grain. */
export type ProjectContribRow = {
  user_id: number
  display_name: string
  task_id: number
  hours: number
}

export async function fetchProjectContribRows(projectId: number): Promise<ProjectContribRow[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_metric_task_contributors')
      .select('user_id, display_name, task_id, hours')
      .eq('project_id', projectId)
      .order('task_id', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    user_id: Number(r.user_id),
    display_name: String(r.display_name ?? `User #${r.user_id}`),
    task_id: Number(r.task_id),
    hours: Number(r.hours ?? 0),
  }))
}

/** One month of a project's history, from R8. */
export type ProjectMonthRow = {
  month: string
  total_hours: number
  hours_on_estimated: number
  hours_on_unestimated: number
  coverage_pct: number | null
  team_members: number
  tasks_touched: number
  /** §5's "unattributed project time" — task-less hours, excluded from every task counter (D4). */
  project_level_hours: number
}

export async function fetchProjectMonthSeries(projectId: number): Promise<ProjectMonthRow[]> {
  const { data, error } = await supabase
    .from('v_metric_project_month')
    .select(
      'month, total_hours, hours_on_estimated, hours_on_unestimated, coverage_pct, team_members, tasks_touched, project_level_hours',
    )
    .eq('project_id', projectId)
    .order('month', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    month: String(r.month),
    total_hours: Number(r.total_hours ?? 0),
    hours_on_estimated: Number(r.hours_on_estimated ?? 0),
    hours_on_unestimated: Number(r.hours_on_unestimated ?? 0),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
    team_members: Number(r.team_members ?? 0),
    tasks_touched: Number(r.tasks_touched ?? 0),
    project_level_hours: Number(r.project_level_hours ?? 0),
  }))
}

/**
 * The canonical `is_estimating_segment` flag for one project — read from the
 * view rather than re-deriving §5's work-model mapping client-side (the same
 * rule the index follows). `null` when the project has no coverage row (no
 * in-scope tasks), in which case no estimation figure renders anyway.
 */
export async function fetchProjectEstimatingFlag(projectId: number): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('v_metric_coverage_by_project')
    .select('is_estimating_segment')
    .eq('project_id', projectId)
    .maybeSingle()
  if (error) throw error
  return data == null ? null : Boolean((data as { is_estimating_segment: boolean }).is_estimating_segment)
}

/** Created/completed dates for the backlog-flow chart, from the S1 scope base. */
export type ProjectFlowRow = { created_on: string; completed_on: string | null }

export async function fetchProjectFlowRows(projectId: number): Promise<ProjectFlowRow[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_scope_tasks')
      .select('created_on, completed_on')
      .eq('project_id', projectId)
      .order('task_id', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    created_on: String(r.created_on),
    completed_on: (r.completed_on as string | null) ?? null,
  }))
}

/** §5 bulk-close days for one project — excluded from flow trends, annotated. */
export type BulkCloseDay = { close_date: string; completions: number }

export async function fetchProjectBulkCloseDays(projectId: number): Promise<BulkCloseDay[]> {
  const { data, error } = await supabase
    .from('v_bulk_close_days')
    .select('close_date, completions')
    .eq('project_id', projectId)
    .order('close_date', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    close_date: String(r.close_date),
    completions: Number(r.completions ?? 0),
  }))
}

/**
 * The project's Radar signals row — the firing banner, runway, and write-off
 * facts. `null` means the project is **outside the dashboard scope** (the view
 * has one row per in-scope project), which the page states explicitly instead
 * of rendering empty metrics.
 */
export async function fetchProjectSignalsRow(projectId: number): Promise<ProjectSignals | null> {
  const { data, error } = await supabase
    .from('v_metric_project_signals')
    .select(SIGNAL_COLUMNS)
    .eq('project_id', projectId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return normalizeSignals(data as unknown as Record<string, unknown>)
}

/** One (task, person, month) slice of the project inside a month range — S7. */
export type ProjectPeriodRow = {
  task_id: number
  user_id: number
  display_name: string
  month: string
  /** Hours this person logged on this task in this month — the only additive column. */
  hours: number
  // task-lifetime facts, repeated per row — never summed
  task_name: string
  assignee_id: number | null
  source: string | null
  task_jira_key: string | null
  created_on: string
  is_completed: boolean
  estimate_hours: number | null
  actual_hours: number
  ratio: number | null
  is_estimated: boolean
  overrun_hours: number
  is_live_overrun: boolean
  is_bucket: boolean
  qa_iterations: number | null
  qa_bugs: number | null
}

export async function fetchProjectPeriodRows(
  projectId: number,
  fromMonth: string,
  toMonth: string,
): Promise<ProjectPeriodRow[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_metric_task_contributor_month')
      .select(
        'task_id, user_id, display_name, month, hours, task_name, assignee_id, source, task_jira_key, ' +
          'created_on, is_completed, estimate_hours, actual_hours, ratio, is_estimated, overrun_hours, ' +
          'is_live_overrun, is_bucket, qa_iterations, qa_bugs',
      )
      .eq('project_id', projectId)
      .gte('month', fromMonth)
      .lte('month', toMonth)
      .order('task_id', { ascending: true })
      .order('user_id', { ascending: true })
      .order('month', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    task_id: Number(r.task_id),
    user_id: Number(r.user_id),
    display_name: String(r.display_name ?? `User #${r.user_id}`),
    month: String(r.month),
    hours: Number(r.hours ?? 0),
    task_name: String(r.task_name ?? ''),
    assignee_id: r.assignee_id == null ? null : Number(r.assignee_id),
    source: (r.source as string | null) ?? null,
    task_jira_key: (r.task_jira_key as string | null) ?? null,
    created_on: String(r.created_on),
    is_completed: Boolean(r.is_completed),
    estimate_hours: r.estimate_hours == null ? null : Number(r.estimate_hours),
    actual_hours: Number(r.actual_hours ?? 0),
    ratio: r.ratio == null ? null : Number(r.ratio),
    is_estimated: Boolean(r.is_estimated),
    overrun_hours: Number(r.overrun_hours ?? 0),
    is_live_overrun: Boolean(r.is_live_overrun),
    is_bucket: Boolean(r.is_bucket),
    qa_iterations: r.qa_iterations == null ? null : Number(r.qa_iterations),
    qa_bugs: r.qa_bugs == null ? null : Number(r.qa_bugs),
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

// ───────────────────────────────────────────────────────────────────────────
// §4.5 People — the coaching-card sources (F5)
//
// Every predicate arrives from a `v_metric_*` view: `meets_sample_floor`,
// `exact_match_flagged`, every ratio and every percentage. Nothing on this
// page is re-derived in the browser (§2.3).
//
// **Load shape.** Each query below was timed against prod as role
// `authenticated` under its real 8s cap before being written, because that is
// the only way this hazard shows up (F2/BUG A: `COUNT(*)` as `postgres`
// returns in 0.36s on a view that takes 42s to project). Measured 2026-08-05:
//
//   v_person roster ...................... 0.21s
//   v_metric_coverage_by_person .......... 0.36s
//   v_metric_overrun_by_person ........... 0.32s
//   v_metric_calibration_by_person ....... 4.52s cold / 0.41s warm
//   v_metric_person_month, full series ... 0.37s
//   v_metric_utilization_by_person_month . 0.43s
//   v_metric_tasks, one person's sample .. 1.6s (n=28) / 3.3s (n=62, worst)
//   v_metric_tasks, WHOLE sample ......... TIMES OUT at 8s — see below
// ───────────────────────────────────────────────────────────────────────────

/**
 * The §4.5 roster: "active loggers only … clients and terminated staff
 * excluded (offboarded people keep historical contributions on project pages,
 * not rows here)".
 *
 * `is_active_roster` is PeopleForce `employed`/`probation` — the same
 * predicate `v_employee_day` uses for capacity, so this page and the
 * utilization denominator can never disagree about who is staff. Measured
 * before shipping: all 25 people it excludes are `pf_status = 'terminated'`
 * bar one unresolved Jira synthetic, and every one of the 32 people who logged
 * in-scope time in the last 30 days is on it. So it drops leavers, not
 * colleagues — and it drops no hours, only rows: 26,253.2h shown +
 * 9,335.0h hidden = 35,588.2h, exactly F2's verified People total.
 */
export type RosterPerson = {
  user_id: number
  display_name: string
  department_name: string | null
  position_name: string | null
  peopleforce_id: number | null
  merged_identities: number
}

export async function fetchActiveRoster(): Promise<RosterPerson[]> {
  const { data, error } = await supabase
    .from('v_person')
    .select('user_id, display_name, department_name, position_name, peopleforce_id, merged_identities')
    .eq('is_active_roster', true)
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    user_id: Number(r.user_id),
    display_name: String(r.display_name ?? ''),
    department_name: (r.department_name as string | null) ?? null,
    position_name: (r.position_name as string | null) ?? null,
    peopleforce_id: r.peopleforce_id == null ? null : Number(r.peopleforce_id),
    merged_identities: Number(r.merged_identities ?? 0),
  }))
}

/**
 * §5 Calibration at person grain, under the ≥40% attribution rule (never
 * assignee-of-record — §1.5.4).
 *
 * `meets_sample_floor` and `exact_match_flagged` are carried separately rather
 * than collapsed here, because they disagree on a real person: Ivan Kotsan is
 * `exact_match_flagged = true` on **n = 2**. `trustFlag()` in
 * `lib/peopleCoaching.ts` is the single place the conjunction is applied.
 */
export type PersonCalibration = {
  user_id: number
  n: number
  median_ratio: number | null
  mean_ratio: number | null
  p90_ratio: number | null
  in_band_pct: number | null
  exact_match_pct: number | null
  exact_match_flagged: boolean
  meets_sample_floor: boolean
  avg_entries_per_task: number | null
  avg_distinct_dates_per_task: number | null
}

export async function fetchCalibrationByPerson(): Promise<PersonCalibration[]> {
  const { data, error } = await supabase
    .from('v_metric_calibration_by_person')
    .select('user_id, n, median_ratio, mean_ratio, p90_ratio, in_band_pct, exact_match_pct, exact_match_flagged, meets_sample_floor, avg_entries_per_task, avg_distinct_dates_per_task')
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    user_id: Number(r.user_id),
    n: Number(r.n ?? 0),
    median_ratio: r.median_ratio == null ? null : Number(r.median_ratio),
    mean_ratio: r.mean_ratio == null ? null : Number(r.mean_ratio),
    p90_ratio: r.p90_ratio == null ? null : Number(r.p90_ratio),
    in_band_pct: r.in_band_pct == null ? null : Number(r.in_band_pct),
    exact_match_pct: r.exact_match_pct == null ? null : Number(r.exact_match_pct),
    exact_match_flagged: Boolean(r.exact_match_flagged),
    meets_sample_floor: Boolean(r.meets_sample_floor),
    avg_entries_per_task: r.avg_entries_per_task == null ? null : Number(r.avg_entries_per_task),
    avg_distinct_dates_per_task:
      r.avg_distinct_dates_per_task == null ? null : Number(r.avg_distinct_dates_per_task),
  }))
}

/**
 * §5 coverage at person grain, kept **split** by `is_estimating_segment`.
 *
 * §4.5 defines the card's coverage as "% of their hours on estimated tasks
 * **within estimating projects**", so the two segment classes must stay
 * separable. Rolling them up first — which the F2 grid does, correctly, for a
 * different question — would put T&M hours that carry no estimates by design
 * into the denominator and manufacture a coverage problem that is really a
 * business-model difference (§2.2, "segment or lie").
 */
export type PersonCoverageSplit = {
  user_id: number
  display_name: string
  is_estimating_segment: boolean
  tasks: number
  estimated_tasks: number
  hours: number
  estimated_hours: number
  unestimated_hours: number
}

export async function fetchCoverageByPersonSplit(): Promise<PersonCoverageSplit[]> {
  const { data, error } = await supabase
    .from('v_metric_coverage_by_person')
    .select('user_id, display_name, is_estimating_segment, tasks, estimated_tasks, hours, estimated_hours, unestimated_hours')
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    user_id: Number(r.user_id),
    display_name: String(r.display_name ?? ''),
    is_estimating_segment: Boolean(r.is_estimating_segment),
    tasks: Number(r.tasks ?? 0),
    estimated_tasks: Number(r.estimated_tasks ?? 0),
    hours: Number(r.hours ?? 0),
    estimated_hours: Number(r.estimated_hours ?? 0),
    unestimated_hours: Number(r.unestimated_hours ?? 0),
  }))
}

/** Monthly hours + coverage per person (R8) — the card's own trend. */
export type PersonMonthPoint = {
  user_id: number
  month: string
  total_hours: number
  coverage_pct: number | null
  projects_touched: number
}

export async function fetchPersonMonthSeries(sinceMonth: string): Promise<PersonMonthPoint[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_metric_person_month')
      .select('user_id, month, total_hours, coverage_pct, projects_touched')
      .gte('month', sinceMonth)
      .order('month', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    user_id: Number(r.user_id),
    month: String(r.month),
    total_hours: Number(r.total_hours ?? 0),
    coverage_pct: r.coverage_pct == null ? null : Number(r.coverage_pct),
    projects_touched: Number(r.projects_touched ?? 0),
  }))
}

/**
 * §5 Utilization off the R4-repaired `v_employee_day`.
 *
 * Always read for a **complete** calendar month. The current month is always
 * partial — 2026-08 showed 1,704h expected against July's 12,586h and 57
 * "zero loggers" — and rendering that as a utilization collapse would be the
 * capacity equivalent of F3's "0 signals means healthy" bug.
 */
export type PersonUtilization = {
  user_id: number
  month: string
  expected_hours: number
  tracked_hours: number
  utilization_pct: number | null
  leave_days: number
  is_zero_logger: boolean
}

export async function fetchPersonUtilization(month: string): Promise<PersonUtilization[]> {
  const { data, error } = await supabase
    .from('v_metric_utilization_by_person_month')
    .select('user_id, month, expected_hours, tracked_hours, utilization_pct, leave_days, is_zero_logger')
    .eq('month', month)
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    user_id: Number(r.user_id),
    month: String(r.month),
    expected_hours: Number(r.expected_hours ?? 0),
    tracked_hours: Number(r.tracked_hours ?? 0),
    utilization_pct: r.utilization_pct == null ? null : Number(r.utilization_pct),
    leave_days: Number(r.leave_days ?? 0),
    is_zero_logger: Boolean(r.is_zero_logger),
  }))
}

/**
 * One person's §5 calibration sample, for the quarterly history (§4.5 person
 * detail: "personal calibration history (quarterly)").
 *
 * **Why this is per-person and not page-wide.** S4/R8 deliberately left
 * ratio / in-band / exact-match out of `v_metric_person_month`, because
 * month-slicing the *contribution* grain would charge a task-lifetime ratio to
 * whichever month its hours happened to fall in. The correct grain keys on the
 * task's `completed_on`, and no such view exists yet — the progress log has
 * carried it as an open question since S4.
 *
 * Fetching the whole sample and bucketing it client-side was the obvious
 * substitute, and it **does not work**: measured as role `authenticated`,
 * `WHERE is_calibration_sample AND attributed_user_id IS NOT NULL` exceeds the
 * 8s cap at 4 projected columns *and still exceeds it at 2*, so this is filter
 * selectivity rather than the projection width F4's revert inferred. The
 * selective `attributed_user_id = $1` form returns in 1.6s (n=28) to 3.3s
 * (n=62, the largest sample any one person has). So the quarterly history is
 * affordable one person at a time, and only there.
 *
 * Only the *bucketing* happens in the browser — `is_calibration_sample`,
 * `ratio` and `is_exact_match` all come from `v_metric_tasks`, exactly as F4's
 * calibration cuts do (§2.3).
 */
export type PersonCalibrationTask = {
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  completed_on: string | null
  estimate_hours: number
  actual_hours: number
  ratio: number
  is_in_band: boolean
  is_exact_match: boolean
}

export async function fetchPersonCalibrationSample(
  userId: number,
): Promise<PersonCalibrationTask[]> {
  const { data, error } = await supabase
    .from('v_metric_tasks')
    .select('task_id, task_name, project_id, project_name, completed_on, estimate_hours, actual_hours, ratio, is_in_band, is_exact_match')
    .eq('is_calibration_sample', true)
    .eq('attributed_user_id', userId)
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    task_id: Number(r.task_id),
    task_name: String(r.task_name ?? ''),
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    completed_on: (r.completed_on as string | null) ?? null,
    estimate_hours: Number(r.estimate_hours ?? 0),
    actual_hours: Number(r.actual_hours ?? 0),
    ratio: Number(r.ratio ?? 0),
    is_in_band: Boolean(r.is_in_band),
    is_exact_match: Boolean(r.is_exact_match),
  }))
}

/**
 * §4.5 person detail: "their current blowouts and stuck tasks, their
 * unestimated worklist".
 *
 * Restricted to the tasks §5 *attributes* to this person, so the list cannot
 * disagree with the calibration figures above it about what they own. A task
 * where they logged 10% of the hours belongs on the project page, not in a
 * conversation about their estimating.
 *
 * All three of §4.5's lists come from **one** query — every open task
 * attributed to them — and are split in the component. Three separate fetches
 * would pay `v_metric_tasks`' CTE cost three times for the same rows, and the
 * selective `attributed_user_id = $1` filter is the only reason any of this is
 * affordable inside the 8s cap (see the note on the calibration sample above).
 */
export type PersonOpenTask = {
  task_id: number
  task_name: string
  project_id: number
  project_name: string
  source: string | null
  task_jira_key: string | null
  estimate_hours: number | null
  actual_hours: number
  overrun_hours: number
  consumption: number | null
  last_time_on: string | null
  days_since_time: number | null
  is_estimated: boolean
  is_live_overrun: boolean
  is_approaching: boolean
  is_stuck: boolean
}

export async function fetchPersonOpenWork(userId: number): Promise<PersonOpenTask[]> {
  const { data, error } = await supabase
    .from('v_metric_tasks')
    .select('task_id, task_name, project_id, project_name, source, task_jira_key, estimate_hours, actual_hours, overrun_live_hours, consumption, last_time_on, days_since_time, is_estimated, is_live_overrun, is_approaching, is_stuck')
    .eq('attributed_user_id', userId)
    .eq('is_completed', false)
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    task_id: Number(r.task_id),
    task_name: String(r.task_name ?? ''),
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    source: (r.source as string | null) ?? null,
    task_jira_key: (r.task_jira_key as string | null) ?? null,
    estimate_hours: r.estimate_hours == null ? null : Number(r.estimate_hours),
    actual_hours: Number(r.actual_hours ?? 0),
    overrun_hours: Number(r.overrun_live_hours ?? 0),
    consumption: r.consumption == null ? null : Number(r.consumption),
    last_time_on: (r.last_time_on as string | null) ?? null,
    days_since_time: r.days_since_time == null ? null : Number(r.days_since_time),
    is_estimated: Boolean(r.is_estimated),
    is_live_overrun: Boolean(r.is_live_overrun),
    is_approaching: Boolean(r.is_approaching),
    is_stuck: Boolean(r.is_stuck),
  }))
}

/**
 * §4.5 logging hygiene: "tracking-deficit history mined from the existing
 * `reminder_deliveries` table … free longitudinal data, zero new sync work".
 *
 * Rows exist only where the Slack reminder system actually ran — today 35
 * people over 2026-05-01 → 2026-07-20. A person with **no** rows has no
 * history, which is not the same as a clean one, and the UI says so rather
 * than rendering an encouraging zero.
 */
export type TrackingDeficit = {
  period_start: string
  period_end: string
  kind: string
  expected_hours: number
  tracked_hours: number
  deficit_hours: number
  status: string
}

export async function fetchTrackingDeficits(userId: number): Promise<TrackingDeficit[]> {
  const { data, error } = await supabase
    .from('reminder_deliveries')
    .select('period_start, period_end, kind, expected_hours, tracked_hours, deficit_hours, status')
    .eq('user_id', userId)
    .order('period_start', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    period_start: String(r.period_start),
    period_end: String(r.period_end),
    kind: String(r.kind ?? ''),
    expected_hours: Number(r.expected_hours ?? 0),
    tracked_hours: Number(r.tracked_hours ?? 0),
    deficit_hours: Number(r.deficit_hours ?? 0),
    status: String(r.status ?? ''),
  }))
}

// ───────────────────────────────────────────────────────────────────────────
// §4.3 Quality + §4.4 Write-offs — F7
//
// Every predicate arrives from a view. The one thing this section computes in
// the browser is *aggregation* over rows a canonical view already classified
// (grouping QA-covered completed tasks by their `completed_on` month, bucketing
// them by `qa_iterations`) — the same thing `fetchCoverageTrend` does, and the
// opposite of re-deriving a §5 predicate (§2.3).
//
// **Load shape.** Timed against prod as role `authenticated`, projecting every
// column, 2026-08-06 — never `COUNT(*)` as `postgres`, which is the trap that
// shipped two views over the 8s cap. Measured cold unless noted:
//
//   v_metric_writeoff_by_month (new, F7) ....... 0.13s
//   v_metric_writeoff_by_project ............... 0.12s
//   v_metric_writeoff_by_segment ............... 0.11s
//   v_metric_returned_rate_by_project .......... 0.29s
//   v_scope_tasks, QA population (706 rows) .... 0.08s
//   v_metric_tasks, is_second_qa_round (22) .... 2.11s  ← staged alone
//   v_metric_tasks, QA population (706 rows) ... 3.93s cold / 0.47s warm  ← NOT USED
//
// **Why the quality task grain reads `v_scope_tasks` and not `v_metric_tasks`.**
// The last line above is F4's Calibration blocker in miniature: `v_metric_tasks`
// materialises the whole §5 attribution machinery — a window function over 6,955
// contributor rows plus a seq scan of 106,202 `time_records` — *before* the
// filter is applied, so selecting 706 of 4,485 rows costs the same as selecting
// all of them (EXPLAIN ANALYZE, 2026-08-06). None of that work is quality work.
//
// `v_scope_tasks` is the S1 scope layer the §5 family is itself built on, and it
// carries every column §4.3 needs. Equivalence was **measured, not assumed**,
// as role `authenticated`:
//
//   QA-covered completed  706 = 706      returned (>= 2)  226 = 226
//   completed            3,171 = 3,171
//   ladder (tasks / avg actual h / estimated / overrun tasks), all three buckets:
//     480 / 7.9h / 221 / 74 · 122 / 11.5h / 56 / 27 · 104 / 24.3h / 53 / 36
//     — byte-identical from both views
//   `overrun_hours` IS NOT DISTINCT FROM `overrun_realized_hours` on every one
//     of the 3,171 completed tasks (0 mismatched rows, Δ 0.0000h) — which is
//     §5 restated: the bucket exclusion belongs to *live* overrun, so on the
//     completed side the two columns are the same number.
//
// The per-project table still reads `v_metric_returned_rate_by_project`
// directly, so the canonical rollup stays the authority and the page carries
// both — if they ever disagree, the page is wrong and it will show.
// ───────────────────────────────────────────────────────────────────────────

/** One row of §4.3's returned-rate + coverage scoreboard. */
export type ReturnedRateRow = {
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  completed_tasks: number
  qa_covered_tasks: number
  qa_coverage_pct: number | null
  returned_tasks: number
  returned_pct: number | null
  open_second_qa_round: number
  avg_hours_iter_1: number | null
  avg_hours_iter_2: number | null
  avg_hours_iter_3plus: number | null
}

/**
 * §4.3's returned rate, QA coverage scoreboard and per-project rework ladder,
 * all from the one canonical view built for them (S3/R5a).
 *
 * Ordered by QA-covered tasks descending: a scoreboard about coverage should
 * open with the projects that actually have some, and §4.3's own example
 * (BUFF, "the internal proof it's doable") is the top row on that order.
 */
export async function fetchReturnedRateByProject(): Promise<ReturnedRateRow[]> {
  const { data, error } = await supabase
    .from('v_metric_returned_rate_by_project')
    .select(
      'project_id, project_name, source, work_model, completed_tasks, qa_covered_tasks, ' +
        'qa_coverage_pct, returned_tasks, returned_pct, open_second_qa_round, ' +
        'avg_hours_iter_1, avg_hours_iter_2, avg_hours_iter_3plus',
    )
    .order('qa_covered_tasks', { ascending: false })
    .order('project_id', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    source: (r.source as string | null) ?? null,
    work_model: String(r.work_model ?? 'unclassified'),
    completed_tasks: Number(r.completed_tasks ?? 0),
    qa_covered_tasks: Number(r.qa_covered_tasks ?? 0),
    qa_coverage_pct: r.qa_coverage_pct == null ? null : Number(r.qa_coverage_pct),
    returned_tasks: Number(r.returned_tasks ?? 0),
    returned_pct: r.returned_pct == null ? null : Number(r.returned_pct),
    open_second_qa_round: Number(r.open_second_qa_round ?? 0),
    avg_hours_iter_1: r.avg_hours_iter_1 == null ? null : Number(r.avg_hours_iter_1),
    avg_hours_iter_2: r.avg_hours_iter_2 == null ? null : Number(r.avg_hours_iter_2),
    avg_hours_iter_3plus: r.avg_hours_iter_3plus == null ? null : Number(r.avg_hours_iter_3plus),
  }))
}

/**
 * One QA-covered completed task. The grain §4.3's portfolio ladder and its
 * monthly trend are both aggregated from — see the section header for why this
 * reads `v_scope_tasks` and the measured proof that it matches `v_metric_tasks`
 * exactly on every figure this page shows.
 */
export type QaCompletedTask = {
  task_id: number
  project_id: number
  completed_on: string | null
  actual_hours: number
  estimate_hours: number | null
  is_estimated: boolean
  overrun_hours: number
  qa_iterations: number
  qa_iterations_capped: boolean
  qa_bugs: number | null
  qa_bugs_capped: boolean
}

export async function fetchQaCompletedTasks(): Promise<QaCompletedTask[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_scope_tasks')
      .select(
        'task_id, project_id, completed_on, actual_hours, estimate_hours, is_estimated, ' +
          'overrun_hours, qa_iterations, qa_iterations_capped, qa_bugs, qa_bugs_capped',
      )
      .eq('is_completed', true)
      .not('qa_iterations', 'is', null)
      .order('task_id', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    task_id: Number(r.task_id),
    project_id: Number(r.project_id),
    completed_on: (r.completed_on as string | null) ?? null,
    actual_hours: Number(r.actual_hours ?? 0),
    estimate_hours: r.estimate_hours == null ? null : Number(r.estimate_hours),
    is_estimated: Boolean(r.is_estimated),
    overrun_hours: Number(r.overrun_hours ?? 0),
    qa_iterations: Number(r.qa_iterations ?? 0),
    qa_iterations_capped: Boolean(r.qa_iterations_capped),
    qa_bugs: r.qa_bugs == null ? null : Number(r.qa_bugs),
    qa_bugs_capped: Boolean(r.qa_bugs_capped),
  }))
}

/**
 * The coverage denominator: every completed in-scope task, month and iteration
 * count only.
 *
 * §5 requires the returned rate to be shown with its coverage %, and coverage
 * needs the *completed* population, not just the labelled subset. Projecting
 * two columns instead of eleven is what makes this affordable — measured on
 * prod as role `authenticated`, the same 3,171-row filter costs **2.31s at 11
 * columns and 0.26s at 2**, so on this view width dominates row count. Kept as
 * a separate narrow read rather than widening `fetchQaCompletedTasks`.
 */
export type CompletedTaskCoverage = {
  completed_on: string | null
  qa_iterations: number | null
}

export async function fetchCompletedTaskCoverage(): Promise<CompletedTaskCoverage[]> {
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('v_scope_tasks')
      .select('completed_on, qa_iterations')
      .eq('is_completed', true)
      .order('task_id', { ascending: true })
      .range(from, to),
  )
  return rows.map((r) => ({
    completed_on: (r.completed_on as string | null) ?? null,
    qa_iterations: r.qa_iterations == null ? null : Number(r.qa_iterations),
  }))
}

/** §4.3's live alarms: an open task already on its 2nd+ QA round. */
export type SecondRoundTask = {
  task_id: number
  project_id: number
  project_name: string
  task_name: string
  source: string | null
  task_jira_key: string | null
  project_jira_key: string | null
  qa_iterations: number
  qa_iterations_capped: boolean
  qa_bugs: number | null
  qa_bugs_capped: boolean
  actual_hours: number
  estimate_hours: number | null
  last_time_on: string | null
  days_since_time: number | null
}

/**
 * The one `v_metric_tasks` read on /quality (2.11s — staged in its own wave).
 * It has to be this view: `is_second_qa_round` is a §5/§4.1 predicate
 * (`NOT is_completed AND COALESCE(qa_iterations, 0) >= 2`) and re-deriving it
 * from the scope layer in the browser is exactly what §2.3 forbids, however
 * cheap it would be.
 */
export async function fetchSecondRoundTasks(): Promise<SecondRoundTask[]> {
  const { data, error } = await supabase
    .from('v_metric_tasks')
    .select(
      'task_id, project_id, project_name, task_name, source, task_jira_key, project_jira_key, ' +
        'qa_iterations, qa_iterations_capped, qa_bugs, qa_bugs_capped, actual_hours, ' +
        'estimate_hours, last_time_on, days_since_time',
    )
    .eq('is_second_qa_round', true)
    .order('qa_iterations', { ascending: false })
    .order('actual_hours', { ascending: false })
    .order('task_id', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    task_id: Number(r.task_id),
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    task_name: String(r.task_name ?? ''),
    source: (r.source as string | null) ?? null,
    task_jira_key: (r.task_jira_key as string | null) ?? null,
    project_jira_key: (r.project_jira_key as string | null) ?? null,
    qa_iterations: Number(r.qa_iterations ?? 0),
    qa_iterations_capped: Boolean(r.qa_iterations_capped),
    qa_bugs: r.qa_bugs == null ? null : Number(r.qa_bugs),
    qa_bugs_capped: Boolean(r.qa_bugs_capped),
    actual_hours: Number(r.actual_hours ?? 0),
    estimate_hours: r.estimate_hours == null ? null : Number(r.estimate_hours),
    last_time_on: (r.last_time_on as string | null) ?? null,
    days_since_time: r.days_since_time == null ? null : Number(r.days_since_time),
  }))
}

// ── §4.4 Write-offs ────────────────────────────────────────────────────────

/**
 * One (month, scope) row of §5 Write-off %.
 *
 * Two rows per month — in-scope and out — so a month's *company* figure is
 * `Σ non_billable / Σ (billable + non_billable)` across both, never the mean of
 * the two percentages (a 300h scope would then weigh the same as a 9,000h one).
 * `foldWriteoffMonths()` in `lib/writeoffs.ts` does that fold exactly once, so
 * no caller gets the chance to get it wrong a second time.
 */
export type WriteoffMonthRow = {
  month: string
  is_in_scope: boolean
  non_billable_hours: number
  billable_hours: number
  untagged_hours: number
  total_hours: number
  writeoff_pct: number | null
}

export async function fetchWriteoffByMonth(): Promise<WriteoffMonthRow[]> {
  const { data, error } = await supabase
    .from('v_metric_writeoff_by_month')
    .select(
      'month, is_in_scope, non_billable_hours, billable_hours, untagged_hours, total_hours, writeoff_pct',
    )
    .order('month', { ascending: true })
    .order('is_in_scope', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    month: String(r.month).slice(0, 10),
    is_in_scope: Boolean(r.is_in_scope),
    non_billable_hours: Number(r.non_billable_hours ?? 0),
    billable_hours: Number(r.billable_hours ?? 0),
    untagged_hours: Number(r.untagged_hours ?? 0),
    total_hours: Number(r.total_hours ?? 0),
    writeoff_pct: r.writeoff_pct == null ? null : Number(r.writeoff_pct),
  }))
}

/**
 * §4.4's ledger. Company-wide by design — the pinned 8.8% is a company number
 * that splits ~19.7% in-scope / ~5.3% out, and hiding the out-of-scope side
 * would hide where most of the non-billable hours actually are (BA activities,
 * Pre-sales, internal PM).
 *
 * `writeoff_flagged` is the view's own boolean off `v_metric_config`
 * (> 15%); the page renders it and never recomputes the comparison.
 *
 * Distinct from F6's `fetchProjectWriteoffMap`, which hard-filters to in-scope
 * and projects 3 of the 12 columns for a lookup map on the Projects index.
 */
export type WriteoffProjectRow = {
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  rate_band: string | null
  is_in_scope: boolean
  non_billable_hours: number
  billable_hours: number
  untagged_hours: number
  total_hours: number
  writeoff_pct: number | null
  writeoff_flagged: boolean | null
}

export async function fetchWriteoffByProject(): Promise<WriteoffProjectRow[]> {
  const { data, error } = await supabase
    .from('v_metric_writeoff_by_project')
    .select(
      'project_id, project_name, source, work_model, rate_band, is_in_scope, ' +
        'non_billable_hours, billable_hours, untagged_hours, total_hours, ' +
        'writeoff_pct, writeoff_flagged',
    )
    .order('non_billable_hours', { ascending: false })
    .order('project_id', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    project_id: Number(r.project_id),
    project_name: String(r.project_name ?? ''),
    source: (r.source as string | null) ?? null,
    work_model: String(r.work_model ?? 'unclassified'),
    rate_band: (r.rate_band as string | null) ?? null,
    is_in_scope: Boolean(r.is_in_scope),
    non_billable_hours: Number(r.non_billable_hours ?? 0),
    billable_hours: Number(r.billable_hours ?? 0),
    untagged_hours: Number(r.untagged_hours ?? 0),
    total_hours: Number(r.total_hours ?? 0),
    writeoff_pct: r.writeoff_pct == null ? null : Number(r.writeoff_pct),
    writeoff_flagged: r.writeoff_flagged == null ? null : Boolean(r.writeoff_flagged),
  }))
}

/** §4.4 / §2's "segment or lie": write-off by work model × in/out of scope. */
export type WriteoffSegmentRow = {
  work_model: string
  is_in_scope: boolean
  non_billable_hours: number
  billable_hours: number
  untagged_hours: number
  total_hours: number
  writeoff_pct: number | null
}

export async function fetchWriteoffBySegment(): Promise<WriteoffSegmentRow[]> {
  const { data, error } = await supabase
    .from('v_metric_writeoff_by_segment')
    .select(
      'work_model, is_in_scope, non_billable_hours, billable_hours, untagged_hours, total_hours, writeoff_pct',
    )
    .order('is_in_scope', { ascending: false })
    .order('non_billable_hours', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    work_model: String(r.work_model ?? 'unclassified'),
    is_in_scope: Boolean(r.is_in_scope),
    non_billable_hours: Number(r.non_billable_hours ?? 0),
    billable_hours: Number(r.billable_hours ?? 0),
    untagged_hours: Number(r.untagged_hours ?? 0),
    total_hours: Number(r.total_hours ?? 0),
    writeoff_pct: r.writeoff_pct == null ? null : Number(r.writeoff_pct),
  }))
}
