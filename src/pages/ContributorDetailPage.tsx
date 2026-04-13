import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { fetchContributorTaskSummary, type ContributorTaskSummary } from '@/lib/queries'
import { formatHours, formatRatio, acTaskUrl } from '@/lib/format'

const columns: ColumnDef<ContributorTaskSummary>[] = [
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
    accessorKey: 'project_name',
    header: 'Project',
    cell: ({ row }) => (
      <Link
        to="/projects/$projectId"
        params={{ projectId: String(row.original.project_id) }}
        className="text-neutral-700 hover:text-blue-600 hover:underline"
      >
        {row.original.project_name}
      </Link>
    ),
  },
  {
    accessorKey: 'estimate_hours',
    header: 'Estimate',
    cell: ({ getValue }) => formatHours(getValue() as number | null),
  },
  {
    accessorKey: 'task_actual_hours',
    header: 'Task actual',
    cell: ({ getValue }) => formatHours(Number(getValue())),
  },
  {
    accessorKey: 'contributor_hours',
    header: 'My hours',
    cell: ({ getValue }) => formatHours(Number(getValue())),
  },
  {
    id: 'share',
    header: 'Share',
    cell: ({ row }) => {
      const actual = Number(row.original.task_actual_hours)
      if (actual === 0) return '—'
      return formatRatio(Number(row.original.contributor_hours) / actual)
    },
  },
  {
    id: 'ratio',
    header: 'Ratio',
    cell: ({ row }) => {
      const est = row.original.estimate_hours
      const actual = Number(row.original.task_actual_hours)
      if (est == null || est === 0) return '—'
      const r = actual / est
      const cls = r >= 2 ? 'text-red-600 font-medium' : r >= 1.5 ? 'text-amber-600' : ''
      return <span className={cls}>{formatRatio(r)}</span>
    },
  },
  {
    accessorKey: 'is_completed',
    header: 'Status',
    cell: ({ getValue }) => (getValue() ? 'Completed' : 'Open'),
  },
]

export function ContributorDetailPage() {
  const { userId } = useParams({ from: '/people/$userId' })
  const uid = Number(userId)
  const [rows, setRows] = useState<ContributorTaskSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchContributorTaskSummary(uid)
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
  }, [uid])

  const name = rows[0]?.contributor_name ?? `User #${uid}`
  const totalHours = rows.reduce((sum, r) => sum + Number(r.contributor_hours), 0)
  const overrunTasks = rows.filter(
    (r) => r.estimate_hours != null && Number(r.task_actual_hours) > r.estimate_hours
  ).length
  const unestimatedTasks = rows.filter((r) => r.estimate_hours == null).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{loading ? 'Loading...' : name}</h2>
        {!loading && (
          <div className="mt-1 flex gap-4 text-xs text-neutral-500">
            <span>{formatHours(totalHours)} total</span>
            <span>{rows.length} tasks</span>
            <span className={overrunTasks > 0 ? 'text-red-600 font-medium' : ''}>{overrunTasks} overrun</span>
            <span className={unestimatedTasks > 0 ? 'text-amber-600 font-medium' : ''}>{unestimatedTasks} unestimated</span>
          </div>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">Tasks contributed to</h3>
        <DataTable data={rows} columns={columns} loading={loading} emptyText="No time records found for this contributor." />
      </section>
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
