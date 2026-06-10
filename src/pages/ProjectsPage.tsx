import { useEffect, useState } from 'react'
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
    accessorKey: 'unestimated_tasks',
    header: 'Unestimated',
    cell: ({ getValue }) => {
      const v = getValue() as number
      return <span className={v > 0 ? 'text-amber-600 font-medium' : ''}>{v}</span>
    },
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
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Projects (by time tracking)</h2>
        <p className="text-xs text-neutral-500">
          Totals per project over tasks with logged time. Bugs Rate / Return Rate are averages of the QA
          labels across the project's labeled tasks — the (n) is how many tasks carry the label.
        </p>
      </div>
      <DataTable data={rows} columns={columns} loading={loading} emptyText="No project data found." />
    </div>
  )
}
