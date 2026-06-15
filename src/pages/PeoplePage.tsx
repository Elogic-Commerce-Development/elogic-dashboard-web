import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { QaRate } from '@/components/QaRate'
import { useFilters } from '@/lib/FilterContext'
import { fetchContributorStats, type ContributorStats } from '@/lib/queries'
import { fetchContributorStatsForPeriod } from '@/lib/periodStats'
import { formatHours } from '@/lib/format'

const columns: ColumnDef<ContributorStats>[] = [
  {
    accessorKey: 'contributor_name',
    header: 'Contributor',
    cell: ({ row }) => (
      <Link
        to="/people/$userId"
        params={{ userId: String(row.original.contributor_id) }}
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.contributor_name}
      </Link>
    ),
  },
  {
    accessorKey: 'total_hours',
    header: 'Total hours',
    cell: ({ getValue }) => formatHours(Number(getValue())),
  },
  { accessorKey: 'tasks_contributed_to', header: 'Tasks' },
  {
    id: 'estimated_tasks',
    header: 'Estimated',
    accessorFn: (r) => r.tasks_contributed_to - r.unestimated_tasks,
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
  { accessorKey: 'active_projects_contributed_to', header: 'Projects' },
]

export function PeoplePage() {
  const { filters } = useFilters()
  const [rows, setRows] = useState<ContributorStats[]>([])
  const [loading, setLoading] = useState(false)

  // This page filters by people + date range only; filters.projectIds is
  // deliberately ignored (the Projects select is hidden here).
  const { from, to, userIds } = filters

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const hasPeriod = Boolean(from || to)
      try {
        const data = await (hasPeriod
          ? fetchContributorStatsForPeriod({ from, to, userIds })
          : fetchContributorStats(userIds))
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [from, to, userIds])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Contributors (by time tracking)</h2>
        <p className="text-xs text-neutral-500">
          Metrics are based on who tracked time on each task, not task assignment. A person appears here if they logged at least one time entry.
          Bugs Rate / Return Rate average the QA labels over the person's labeled tasks — the (n) is how many tasks carry the label.
        </p>
      </div>
      <DataTable data={rows} columns={columns} loading={loading} emptyText="No contributor data found." />
    </div>
  )
}
