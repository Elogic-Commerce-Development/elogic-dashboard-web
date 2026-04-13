import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { supabase } from '@/lib/supabase'
import type { TaskActualVsEstimate, RecentOverrun } from '@/lib/queries'
import { formatHours, acProjectUrl, acTaskUrl } from '@/lib/format'

type ProjectInfo = { id: number; name: string; is_completed: boolean }
type TaskFilter = 'all' | 'open-overrun' | 'open-unestimated-active'

const taskColumns: ColumnDef<TaskActualVsEstimate>[] = [
  {
    accessorKey: 'task_name',
    header: 'Task',
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Link
          to="/tasks/$taskId"
          params={{ taskId: String(row.original.task_id) }}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {row.original.task_name}
        </Link>
        <a
          href={acTaskUrl(row.original.project_id, row.original.task_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-neutral-400 hover:text-neutral-600"
          title="Open in ActiveCollab"
        >
          <ExternalLinkIcon />
        </a>
      </div>
    ),
  },
  {
    accessorKey: 'assignee_name',
    header: 'Assignee',
    cell: ({ getValue }) => (getValue() as string | null) ?? '—',
  },
  {
    accessorKey: 'estimate_hours',
    header: 'Estimate',
    cell: ({ getValue }) => formatHours(getValue() as number | null),
  },
  {
    accessorKey: 'actual_hours',
    header: 'Actual',
    cell: ({ getValue }) => formatHours(getValue() as number),
  },
  {
    accessorKey: 'ratio',
    header: 'Ratio',
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
    header: 'Overrun',
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
  const pid = Number(projectId)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [tasks, setTasks] = useState<TaskActualVsEstimate[]>([])
  const [recentOverruns, setRecentOverruns] = useState<RecentOverrun[]>([])
  const [contributors, setContributors] = useState<{ contributor_id: number; contributor_name: string; hours: number; tasks: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const loadProject = supabase
      .from('projects')
      .select('id, name, is_completed')
      .eq('id', pid)
      .maybeSingle()

    const loadTasks = supabase
      .from('v_task_actual_vs_estimate')
      .select('*')
      .eq('project_id', pid)
      .order('created_on', { ascending: false })
      .limit(500)

    const loadContributors = supabase
      .from('v_contributor_task_summary')
      .select('contributor_id, contributor_name, contributor_hours, task_id')
      .eq('project_id', pid)

    const loadRecentOverruns = supabase
      .from('v_recent_overrun_activity')
      .select('*')
      .eq('project_id', pid)

    Promise.all([loadProject, loadTasks, loadContributors, loadRecentOverruns])
      .then(([pRes, tRes, cRes, roRes]) => {
        if (cancelled) return
        if (pRes.data) setProject(pRes.data as ProjectInfo)
        setTasks((tRes.data ?? []) as TaskActualVsEstimate[])
        setRecentOverruns((roRes.data ?? []) as RecentOverrun[])

        // Aggregate contributor rows
        const map = new Map<number, { contributor_id: number; contributor_name: string; hours: number; tasks: Set<number> }>()
        for (const r of (cRes.data ?? []) as { contributor_id: number; contributor_name: string; contributor_hours: number; task_id: number }[]) {
          const existing = map.get(r.contributor_id)
          if (existing) {
            existing.hours += Number(r.contributor_hours)
            existing.tasks.add(r.task_id)
          } else {
            map.set(r.contributor_id, { contributor_id: r.contributor_id, contributor_name: r.contributor_name, hours: Number(r.contributor_hours), tasks: new Set([r.task_id]) })
          }
        }
        setContributors(
          Array.from(map.values())
            .map(({ tasks: taskSet, ...rest }) => ({ ...rest, tasks: taskSet.size }))
            .sort((a, b) => b.hours - a.hours)
        )
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [pid])

  // Reset filter when navigating to a different project
  useEffect(() => { setTaskFilter('all') }, [pid])

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

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'open-overrun') return tasks.filter(isOpenOverrun)
    if (taskFilter === 'open-unestimated-active') return tasks.filter(isOpenUnestimatedActive)
    return tasks
  }, [tasks, taskFilter])

  const toggleFilter = (f: TaskFilter) => setTaskFilter(prev => prev === f ? 'all' : f)

  if (loading) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading project...</div>
  }

  if (!project) {
    return <div className="py-12 text-center text-sm text-neutral-400">Project not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{project.name}</h2>
        <a
          href={acProjectUrl(project.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 hover:text-neutral-600"
          title="Open in ActiveCollab"
        >
          <ExternalLinkIcon />
        </a>
        {project.is_completed && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Completed</span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Tasks w/o estimates"
          value={String(metrics.totalWithoutEstimate)}
          sub={`${metrics.openWithoutEstimate} open`}
          color={metrics.totalWithoutEstimate > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Open w/o estimate, active"
          value={String(metrics.openWithoutEstimateWithTime)}
          sub="open + tracked time"
          color={metrics.openWithoutEstimateWithTime > 0 ? 'orange' : 'emerald'}
          active={taskFilter === 'open-unestimated-active'}
          onClick={metrics.openWithoutEstimateWithTime > 0 ? () => toggleFilter('open-unestimated-active') : undefined}
        />
        <KpiCard
          label="Total overrun"
          value={formatHours(metrics.totalOverrunHours)}
          sub={`${metrics.totalOverrunPct}% of estimates`}
          color={metrics.totalOverrunHours > 0 ? 'red' : 'emerald'}
        />
        <KpiCard
          label="Last 30d overrun"
          value={formatHours(lastMonthMetrics.hours)}
          sub={`${lastMonthMetrics.pct}% of estimates`}
          color={lastMonthMetrics.hours > 0 ? 'red' : 'emerald'}
        />
        <KpiCard
          label="Overrun tasks"
          value={`${metrics.overrunTaskCount}`}
          sub={`${metrics.openOverrunCount} open`}
          color={metrics.openOverrunCount > 0 ? 'red' : metrics.overrunTaskCount > 0 ? 'amber' : 'emerald'}
          active={taskFilter === 'open-overrun'}
          onClick={metrics.openOverrunCount > 0 ? () => toggleFilter('open-overrun') : undefined}
        />
        <KpiCard
          label="Total tasks"
          value={String(tasks.length)}
          color={taskFilter !== 'all' ? 'blue' : 'neutral'}
          onClick={taskFilter !== 'all' ? () => setTaskFilter('all') : undefined}
          sub={taskFilter !== 'all' ? 'click to reset filter' : undefined}
        />
      </div>

      {/* Filter pills */}
      {(metrics.openOverrunCount > 0 || metrics.openWithoutEstimateWithTime > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-400">Show:</span>
          <button
            onClick={() => setTaskFilter('all')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              taskFilter === 'all'
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50'
            }`}
          >
            All tasks ({tasks.length})
          </button>
          {metrics.openOverrunCount > 0 && (
            <button
              onClick={() => toggleFilter('open-overrun')}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                taskFilter === 'open-overrun'
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100'
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${
                taskFilter === 'open-overrun' ? 'bg-white' : 'bg-red-400'
              }`} />
              Open + overrun ({metrics.openOverrunCount})
            </button>
          )}
          {metrics.openWithoutEstimateWithTime > 0 && (
            <button
              onClick={() => toggleFilter('open-unestimated-active')}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                taskFilter === 'open-unestimated-active'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100'
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${
                taskFilter === 'open-unestimated-active' ? 'bg-white' : 'bg-amber-400'
              }`} />
              Open, no estimate, tracked time ({metrics.openWithoutEstimateWithTime})
            </button>
          )}
        </div>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">
          Tasks ({filteredTasks.length}{taskFilter !== 'all' ? ` of ${tasks.length}` : ''})
        </h3>
        <DataTable
          data={filteredTasks}
          columns={taskColumns}
          loading={false}
          emptyText="No tasks in this project."
          rowClassName={getTaskRowClassName}
        />
      </section>

      {contributors.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Contributors ({contributors.length})</h3>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Hours</th>
                  <th className="px-4 py-2 font-medium">Tasks</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
