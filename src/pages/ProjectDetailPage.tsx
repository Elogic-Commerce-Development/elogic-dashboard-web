import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Accordion } from '@/components/Accordion'
import { DataTable } from '@/components/DataTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { QaRate } from '@/components/QaRate'
import { supabase } from '@/lib/supabase'
import { fetchAllTasksFiltered, type TaskActualVsEstimate, type RecentOverrun } from '@/lib/queries'
import { fetchProjectPeriodDetail, type ProjectContributorRow } from '@/lib/periodStats'
import { formatHours, externalProjectLink, externalTaskLink } from '@/lib/format'
import { periodRange, type PeriodPreset } from '@/lib/period'
import { SourceBadge } from '@/components/SourceBadge'

type ProjectInfo = {
  id: number
  name: string
  is_completed: boolean
  source: string | null
  jira_key: string | null
}
type TaskFilter = 'all' | 'unestimated' | 'open-unestimated-active' | 'overrun' | 'open-overrun' | 'recent-overrun'

/**
 * In period mode `period_hours` carries the hours logged within the range
 * (shown in the Actual column); the lifetime fields stay untouched so the
 * KPI cards, row highlighting, and Ratio/Overrun columns keep their
 * all-time semantics.
 */
type ProjectTaskRow = TaskActualVsEstimate & { period_hours?: number }

function makeTaskColumns(periodActive: boolean): ColumnDef<ProjectTaskRow>[] {
  return [
    {
      accessorKey: 'task_name',
      header: 'Task',
      cell: ({ row }) => {
        const ext = externalTaskLink({
          source: row.original.source,
          projectId: row.original.project_id,
          taskId: row.original.task_id,
          taskJiraKey: row.original.task_jira_key,
        })
        return (
          <div className="flex items-center gap-1.5">
            <Link
              to="/tasks/$taskId"
              params={{ taskId: String(row.original.task_id) }}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {row.original.task_name}
            </Link>
            <SourceBadge source={row.original.source} />
            <a
              href={ext.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-neutral-400 hover:text-neutral-600"
              title={ext.label}
            >
              <ExternalLinkIcon />
            </a>
          </div>
        )
      },
    },
    {
      accessorKey: 'assignee_name',
      header: 'Assignee',
      cell: ({ row }) => {
        const id = row.original.assignee_id
        const name = row.original.assignee_name
        if (id == null || name == null) return '—'
        return (
          <Link
            to="/people/$userId"
            params={{ userId: String(id) }}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {name}
          </Link>
        )
      },
    },
    {
      accessorKey: 'estimate_hours',
      header: 'Estimate',
      cell: ({ getValue }) => formatHours(getValue() as number | null),
    },
    {
      id: 'actual',
      header: periodActive ? 'Actual (period)' : 'Actual',
      accessorFn: (r) => (periodActive ? Number(r.period_hours ?? 0) : Number(r.actual_hours)),
      cell: ({ getValue }) => formatHours(getValue() as number),
    },
    {
      accessorKey: 'ratio',
      header: periodActive ? 'Ratio (all-time)' : 'Ratio',
      cell: ({ row }) => {
        const r = row.original.ratio != null ? Number(row.original.ratio) : null
        if (r == null) return '—'
        const pct = Math.round(r * 100)
        const cls = r >= 2 ? 'text-red-600 font-semibold' : r >= 1.5 ? 'text-amber-600 font-medium' : ''
        return <span className={cls}>{pct}%</span>
      },
    },
    {
      id: 'overrun',
      header: periodActive ? 'Overrun (all-time)' : 'Overrun',
      cell: ({ row }) => {
        const est = row.original.estimate_hours != null ? Number(row.original.estimate_hours) : null
        const act = Number(row.original.actual_hours)
        if (est == null || est === 0) return '—'
        const diff = act - est
        if (diff <= 0) return <span className="text-emerald-600">—</span>
        return <span className="font-medium text-red-600">+{formatHours(diff)}</span>
      },
    },
    {
      accessorKey: 'is_completed',
      header: 'Status',
      cell: ({ getValue }) => (getValue() ? 'Completed' : 'Open'),
    },
  ]
}

function isOpenOverrun(t: TaskActualVsEstimate): boolean {
  return !t.is_completed && t.estimate_hours != null && Number(t.estimate_hours) > 0 && Number(t.actual_hours) > Number(t.estimate_hours)
}

function isOpenUnestimatedActive(t: TaskActualVsEstimate): boolean {
  return !t.is_completed && t.estimate_hours == null && Number(t.actual_hours) > 0
}

function getTaskRowClassName(task: TaskActualVsEstimate): string {
  if (isOpenOverrun(task)) {
    return 'bg-red-50 border-t border-red-100 hover:bg-red-100'
  }
  if (isOpenUnestimatedActive(task)) {
    return 'bg-amber-50 border-t border-amber-100 hover:bg-amber-100'
  }
  return 'border-t border-neutral-100 hover:bg-neutral-50'
}

type ContribViewRow = {
  contributor_id: number
  contributor_name: string
  contributor_hours: number
  task_id: number
  estimate_hours: number | null
  task_actual_hours: number
  qa_bugs: number | null
  qa_iterations: number | null
}

/**
 * All-time contributor rows for one project from v_contributor_task_summary,
 * paginated past the 1000-row response cap (one row per (user, task)).
 */
async function fetchProjectContributorRows(pid: number): Promise<ContribViewRow[]> {
  const PAGE = 1000
  const all: ContribViewRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('v_contributor_task_summary')
      .select('contributor_id, contributor_name, contributor_hours, task_id, estimate_hours, task_actual_hours, qa_bugs, qa_iterations')
      .eq('project_id', pid)
      .order('contributor_id')
      .order('task_id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as ContribViewRow[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

function aggregateAllTimeContributors(rows: ContribViewRow[]): ProjectContributorRow[] {
  type Acc = ProjectContributorRow & { bugsSum: number; iterSum: number }
  const map = new Map<number, Acc>()
  for (const r of rows) {
    let acc = map.get(r.contributor_id)
    if (!acc) {
      acc = {
        contributor_id: r.contributor_id,
        contributor_name: r.contributor_name,
        hours: 0,
        tasks: 0,
        overrun_tasks: 0,
        hours_on_overrun: 0,
        avg_qa_bugs: null,
        qa_bugs_tasks: 0,
        avg_qa_iterations: null,
        qa_iterations_tasks: 0,
        bugsSum: 0,
        iterSum: 0,
      }
      map.set(r.contributor_id, acc)
    }
    const hours = Number(r.contributor_hours)
    acc.hours += hours
    acc.tasks += 1
    if (r.estimate_hours != null && Number(r.task_actual_hours) > Number(r.estimate_hours)) {
      acc.overrun_tasks += 1
      acc.hours_on_overrun += hours
    }
    if (r.qa_bugs != null) {
      acc.bugsSum += Number(r.qa_bugs)
      acc.qa_bugs_tasks += 1
    }
    if (r.qa_iterations != null) {
      acc.iterSum += Number(r.qa_iterations)
      acc.qa_iterations_tasks += 1
    }
  }
  return Array.from(map.values())
    .map(({ bugsSum, iterSum, ...rest }) => ({
      ...rest,
      avg_qa_bugs: rest.qa_bugs_tasks > 0 ? bugsSum / rest.qa_bugs_tasks : null,
      avg_qa_iterations: rest.qa_iterations_tasks > 0 ? iterSum / rest.qa_iterations_tasks : null,
    }))
    .sort((a, b) => b.hours - a.hours)
}

function KpiCard({
  label,
  value,
  sub,
  color,
  active,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  color: 'red' | 'amber' | 'orange' | 'emerald' | 'blue' | 'neutral'
  active?: boolean
  onClick?: () => void
}) {
  const colorMap = {
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    orange: 'border-orange-200 bg-orange-50 text-orange-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    neutral: 'border-neutral-200 bg-white text-neutral-900',
  }
  const activeRing = active ? 'ring-2 ring-offset-1 ring-neutral-900' : ''
  const clickable = onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${colorMap[color]} ${activeRing} ${clickable}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs opacity-70">{label}</div>
      {sub && <div className="mt-0.5 text-xs font-medium opacity-60">{sub}</div>}
    </div>
  )
}

export function ProjectDetailPage() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const search = useSearch({ from: '/projects/$projectId' })
  const navigate = useNavigate()
  const pid = Number(projectId)

  const activePreset: PeriodPreset = search.preset ?? 'current_month'
  const isAllTime = activePreset === 'all_time'
  const range = useMemo(
    () => periodRange(activePreset, search.from, search.to),
    [activePreset, search.from, search.to],
  )
  const rangeFrom = range.from
  const rangeTo = range.to

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [tasks, setTasks] = useState<ProjectTaskRow[]>([])
  const [recentOverruns, setRecentOverruns] = useState<RecentOverrun[]>([])
  const [contributors, setContributors] = useState<ProjectContributorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [tasksOpen, setTasksOpen] = useState(false)
  const [contributorsOpen, setContributorsOpen] = useState(false)

  // Reset the task filter to 'all' when the project or period changes (e.g. a
  // dangling 'recent-overrun' filter after leaving all-time mode). Done during
  // render via the previous-key pattern rather than in an effect, so the reset
  // lands before paint without a cascading effect render.
  const taskFilterKey = `${pid}|${isAllTime}|${rangeFrom}|${rangeTo}`
  const [prevTaskFilterKey, setPrevTaskFilterKey] = useState(taskFilterKey)
  if (taskFilterKey !== prevTaskFilterKey) {
    setPrevTaskFilterKey(taskFilterKey)
    setTaskFilter('all')
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const pRes = await supabase
        .from('projects')
        .select('id, name, is_completed, source, jira_key')
        .eq('id', pid)
        .maybeSingle()
      if (!cancelled && pRes.data) setProject(pRes.data as ProjectInfo)

      if (isAllTime) {
        const [taskRows, contribRows, roRes] = await Promise.all([
          fetchAllTasksFiltered([pid], []),
          fetchProjectContributorRows(pid),
          supabase.from('v_recent_overrun_activity').select('*').eq('project_id', pid),
        ])
        if (cancelled) return
        setTasks(taskRows)
        setContributors(aggregateAllTimeContributors(contribRows))
        setRecentOverruns((roRes.data ?? []) as RecentOverrun[])
      } else {
        const detail = await fetchProjectPeriodDetail(pid, rangeFrom, rangeTo)
        if (cancelled) return
        setTasks(detail.taskRows)
        setContributors(detail.contributors)
        setRecentOverruns([])
      }
    }

    load()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [pid, isAllTime, rangeFrom, rangeTo])

  function setPeriod(preset: PeriodPreset, customFrom?: string, customTo?: string) {
    navigate({
      to: '/projects/$projectId',
      params: { projectId: String(pid) },
      search: () => ({
        preset,
        from: preset === 'custom' ? customFrom : undefined,
        to: preset === 'custom' ? customTo : undefined,
      }),
    })
  }

  const metrics = useMemo(() => {
    const totalWithoutEstimate = tasks.filter(t => t.estimate_hours == null).length
    const openWithoutEstimate = tasks.filter(t => t.estimate_hours == null && !t.is_completed).length
    const openWithoutEstimateWithTime = tasks.filter(t => isOpenUnestimatedActive(t)).length

    const overrunTasks = tasks.filter(t => t.estimate_hours != null && Number(t.estimate_hours) > 0 && Number(t.actual_hours) > Number(t.estimate_hours))
    const totalOverrunHours = overrunTasks.reduce((sum, t) => sum + (Number(t.actual_hours) - Number(t.estimate_hours!)), 0)

    const estimatedTasks = tasks.filter(t => t.estimate_hours != null && Number(t.estimate_hours) > 0)
    const totalEstimateHours = estimatedTasks.reduce((sum, t) => sum + Number(t.estimate_hours!), 0)
    const totalOverrunPct = totalEstimateHours > 0 ? Math.round((totalOverrunHours / totalEstimateHours) * 100) : 0

    const openOverrunCount = overrunTasks.filter(t => !t.is_completed).length

    return {
      totalWithoutEstimate,
      openWithoutEstimate,
      openWithoutEstimateWithTime,
      totalOverrunHours,
      totalOverrunPct,
      overrunTaskCount: overrunTasks.length,
      openOverrunCount,
    }
  }, [tasks])

  const lastMonthMetrics = useMemo(() => {
    const overrunHours = recentOverruns.reduce((sum, r) => sum + (Number(r.actual_hours) - Number(r.estimate_hours)), 0)
    const estimateBase = recentOverruns.reduce((sum, r) => sum + Number(r.estimate_hours), 0)
    const pct = estimateBase > 0 ? Math.round((overrunHours / estimateBase) * 100) : 0
    return { hours: overrunHours, pct, taskCount: recentOverruns.length }
  }, [recentOverruns])

  const recentOverrunTaskIds = useMemo(() => new Set(recentOverruns.map(r => r.task_id)), [recentOverruns])

  const filteredTasks = useMemo(() => {
    switch (taskFilter) {
      case 'unestimated': return tasks.filter(t => t.estimate_hours == null)
      case 'open-unestimated-active': return tasks.filter(isOpenUnestimatedActive)
      case 'overrun': return tasks.filter(t => t.estimate_hours != null && Number(t.estimate_hours) > 0 && Number(t.actual_hours) > Number(t.estimate_hours))
      case 'open-overrun': return tasks.filter(isOpenOverrun)
      case 'recent-overrun': return tasks.filter(t => recentOverrunTaskIds.has(t.task_id))
      default: return tasks
    }
  }, [tasks, taskFilter, recentOverrunTaskIds])

  const taskColumns = useMemo(() => makeTaskColumns(!isAllTime), [isAllTime])

  // KPI clicks open the Tasks accordion — otherwise the filter they apply
  // is invisible behind a collapsed section.
  const toggleFilter = (f: TaskFilter) => {
    setTaskFilter(prev => prev === f ? 'all' : f)
    setTasksOpen(true)
  }

  if (loading && !project) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading project...</div>
  }

  if (!project) {
    return <div className="py-12 text-center text-sm text-neutral-400">Project not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{project.name}</h2>
        <SourceBadge source={project.source} />
        <a
          href={externalProjectLink({
            source: project.source,
            projectId: project.id,
            projectJiraKey: project.jira_key,
          }).url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 hover:text-neutral-600"
          title={externalProjectLink({
            source: project.source,
            projectId: project.id,
            projectJiraKey: project.jira_key,
          }).label}
        >
          <ExternalLinkIcon />
        </a>
        {project.is_completed && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Completed</span>
        )}
      </div>

      <PeriodSwitcher
        preset={activePreset}
        customFrom={search.from}
        customTo={search.to}
        onChange={setPeriod}
        includeAllTime
      />

      {/* KPI cards */}
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${isAllTime ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <KpiCard
          label="Tasks w/o estimates"
          value={String(metrics.totalWithoutEstimate)}
          sub={`${metrics.openWithoutEstimate} open`}
          color={metrics.totalWithoutEstimate > 0 ? 'amber' : 'emerald'}
          active={taskFilter === 'unestimated'}
          onClick={() => toggleFilter('unestimated')}
        />
        <KpiCard
          label="Open w/o estimate, active"
          value={String(metrics.openWithoutEstimateWithTime)}
          sub="open + tracked time"
          color={metrics.openWithoutEstimateWithTime > 0 ? 'orange' : 'emerald'}
          active={taskFilter === 'open-unestimated-active'}
          onClick={() => toggleFilter('open-unestimated-active')}
        />
        <KpiCard
          label="Total overrun"
          value={formatHours(metrics.totalOverrunHours)}
          sub={`${metrics.totalOverrunPct}% of estimates`}
          color={metrics.totalOverrunHours > 0 ? 'red' : 'emerald'}
          active={taskFilter === 'overrun'}
          onClick={() => toggleFilter('overrun')}
        />
        {isAllTime && (
          <KpiCard
            label="Last 30d overrun"
            value={formatHours(lastMonthMetrics.hours)}
            sub={`${lastMonthMetrics.pct}% of estimates`}
            color={lastMonthMetrics.hours > 0 ? 'red' : 'emerald'}
            active={taskFilter === 'recent-overrun'}
            onClick={() => toggleFilter('recent-overrun')}
          />
        )}
        <KpiCard
          label="Overrun tasks"
          value={`${metrics.overrunTaskCount}`}
          sub={`${metrics.openOverrunCount} open`}
          color={metrics.openOverrunCount > 0 ? 'red' : metrics.overrunTaskCount > 0 ? 'amber' : 'emerald'}
          active={taskFilter === 'open-overrun'}
          onClick={() => toggleFilter('open-overrun')}
        />
        <KpiCard
          label={isAllTime ? 'Total tasks' : 'Tasks in period'}
          value={String(tasks.length)}
          color={taskFilter !== 'all' ? 'blue' : 'neutral'}
          onClick={() => { setTaskFilter('all'); setTasksOpen(true) }}
        />
      </div>

      {/* Active filter indicator — outside the accordion so it stays visible
          even when the Tasks section is re-collapsed. */}
      {taskFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">
            Filtered: <span className="font-semibold">{filteredTasks.length}</span> of {tasks.length} tasks
          </span>
          <button
            onClick={() => setTaskFilter('all')}
            className="rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            Clear filter
          </button>
        </div>
      )}

      <Accordion
        title="Tasks"
        meta={`${filteredTasks.length}${taskFilter !== 'all' ? ` of ${tasks.length}` : ''}${isAllTime ? '' : ' · in period'}`}
        open={tasksOpen}
        onToggle={() => setTasksOpen(v => !v)}
      >
        <DataTable
          data={filteredTasks}
          columns={taskColumns}
          loading={loading}
          emptyText={isAllTime ? 'No tasks in this project.' : 'No tasks with logged time in this period.'}
          rowClassName={getTaskRowClassName}
        />
      </Accordion>

      <Accordion
        title="Contributors"
        meta={`${contributors.length}${isAllTime ? '' : ' · in period'}`}
        open={contributorsOpen}
        onToggle={() => setContributorsOpen(v => !v)}
      >
        {contributors.length === 0 ? (
          <div className="py-6 text-center text-sm text-neutral-400">
            {isAllTime ? 'No tracked time in this project.' : 'No tracked time in this period.'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Hours</th>
                  <th className="px-4 py-2 font-medium">Tasks</th>
                  <th className="px-4 py-2 font-medium">Overrun</th>
                  <th className="px-4 py-2 font-medium">Hours on overrun</th>
                  <th className="px-4 py-2 font-medium">Bugs Rate</th>
                  <th className="px-4 py-2 font-medium">Return Rate</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c) => (
                  <tr key={c.contributor_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <Link to="/people/$userId" params={{ userId: String(c.contributor_id) }} className="text-blue-600 hover:text-blue-800 hover:underline">
                        {c.contributor_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{formatHours(c.hours)}</td>
                    <td className="px-4 py-2">{c.tasks}</td>
                    <td className="px-4 py-2">
                      <span className={c.overrun_tasks > 0 ? 'text-red-600 font-medium' : ''}>{c.overrun_tasks}</span>
                    </td>
                    <td className="px-4 py-2">{formatHours(c.hours_on_overrun)}</td>
                    <td className="px-4 py-2">
                      <QaRate kind="bugs" value={c.avg_qa_bugs} sampleSize={c.qa_bugs_tasks} />
                    </td>
                    <td className="px-4 py-2">
                      <QaRate kind="iterations" value={c.avg_qa_iterations} sampleSize={c.qa_iterations_tasks} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Accordion>
    </div>
  )
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}
