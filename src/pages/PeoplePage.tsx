import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { fetchContributorStats, type ContributorStats } from '@/lib/queries'
import { formatHours, formatRatio } from '@/lib/format'

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
    accessorKey: 'estimate_adoption',
    header: 'Adoption',
    cell: ({ getValue }) => formatRatio(getValue() as number | null),
  },
  {
    accessorKey: 'median_ratio',
    header: 'Median ratio',
    cell: ({ getValue }) => {
      const r = getValue() as number | null
      const cls = r != null && r >= 2 ? 'text-red-600 font-medium' : r != null && r >= 1.5 ? 'text-amber-600' : ''
      return <span className={cls}>{formatRatio(r)}</span>
    },
  },
  { accessorKey: 'projects_contributed_to', header: 'Projects' },
]

export function PeoplePage() {
  const [rows, setRows] = useState<ContributorStats[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchContributorStats()
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
  }, [])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Contributors (by time tracking)</h2>
        <p className="text-xs text-neutral-500">
          Metrics are based on who tracked time on each task, not task assignment. A person appears here if they logged at least one time entry.
        </p>
      </div>
      <DataTable data={rows} columns={columns} loading={loading} emptyText="No contributor data found." />
    </div>
  )
}
