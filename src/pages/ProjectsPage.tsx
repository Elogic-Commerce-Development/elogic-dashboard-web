import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { QaRate } from '@/components/QaRate'
import { useFilters } from '@/lib/FilterContext'
import { fetchProjectStats, type ProjectStats } from '@/lib/queries'
import { fetchProjectStatsForPeriod } from '@/lib/periodStats'
import { formatHours } from '@/lib/format'

const columns: ColumnDef<ProjectStats>[] = [
  {
    accessorKey: 'project_name',
    header: 'Project Name',
    cell: ({ row }) => (
      <Link
        to="/projects/$projectId"
        params={{ projectId: String(row.original.project_id) }}
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.project_name}
      </Link>
    ),
  },
  {
    accessorKey: 'total_hours',
    header: 'Total hours',
    cell: ({ getValue }) => formatHours(Number(getValue())),
  },
  { accessorKey: 'tasks_with_time', header: 'Tasks' },
  {
    id: 'estimated_tasks',
    header: 'Estimated',
    accessorFn: (r) => r.tasks_with_time - r.unestimated_tasks,
    cell: ({ getValue }) => getValue() as number,
  },
  {
    accessorKey: 'overrun_tasks',
    header: 'Overrun',
    cell: ({ getValue }) => {
      const v = getValue() as number
      return <span className={v > 0 ? 'text-red-600 font-medium' : ''}>{v}</span>
    },
  },
  {
    accessorKey: 'hours_on_overrun',
    header: 'Hours on overrun',
    cell: ({ getValue }) => formatHours(Number(getValue())),
  },
  {
    id: 'bugs_rate',
    header: 'Bugs Rate',
    accessorFn: (r) => r.avg_qa_bugs ?? -1,
    cell: ({ row }) => (
      <QaRate kind="bugs" value={row.original.avg_qa_bugs} sampleSize={row.original.qa_bugs_tasks} />
    ),
  },
  {
    id: 'return_rate',
    header: 'Return Rate',
    accessorFn: (r) => r.avg_qa_iterations ?? -1,
    cell: ({ row }) => (
      <QaRate
        kind="iterations"
        value={row.original.avg_qa_iterations}
        sampleSize={row.original.qa_iterations_tasks}
      />
    ),
  },
  { accessorKey: 'team_members', header: 'Team Members' },
]

export function ProjectsPage() {
  const { filters } = useFilters()
  const [rows, setRows] = useState<ProjectStats[]>([])
  const [loading, setLoading] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  // Default to active projects only; the toggle reveals completed ones. Works
  // in both all-time (is_completed from v_project_stats) and period mode
  // (is_completed set from the projects map in periodStats).
  const visibleRows = useMemo(
    () => (showCompleted ? rows : rows.filter((r) => !r.is_completed)),
    [rows, showCompleted],
  )
  const completedCount = useMemo(() => rows.filter((r) => r.is_completed).length, [rows])

  // This page filters by projects + date range only; filters.userIds is
  // deliberately ignored (the Users select is hidden here).
  const { from, to, projectIds } = filters

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const hasPeriod = Boolean(from || to)
    const load = hasPeriod
      ? fetchProjectStatsForPeriod({ from, to, projectIds })
      : fetchProjectStats(projectIds)
    load
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, projectIds])

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Projects (by time tracking)</h2>
          <p className="text-xs text-neutral-500">
            Totals per project over tasks with logged time. Bugs Rate / Return Rate are averages of the QA
            labels across the project's labeled tasks — the (n) is how many tasks carry the label.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-blue-600"
          />
          Show completed{completedCount > 0 ? ` (${completedCount})` : ''}
        </label>
      </div>
      <DataTable data={visibleRows} columns={columns} loading={loading} emptyText="No project data found." />
    </div>
  )
}
