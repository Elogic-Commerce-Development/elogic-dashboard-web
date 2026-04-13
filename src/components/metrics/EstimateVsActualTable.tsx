import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import type { Filters } from '@/lib/filters'
import { fetchActualVsEstimate, type TaskActualVsEstimate } from '@/lib/queries'
import { formatHours, formatRatio, formatDate, acTaskUrl } from '@/lib/format'

const columns: ColumnDef<TaskActualVsEstimate>[] = [
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
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
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
    accessorKey: 'assignee_name',
    header: 'Assignee',
    cell: ({ row }) => {
      const name = row.original.assignee_name
      const id = row.original.assignee_id
      if (!name || id == null) return '—'
      return (
        <Link to="/people/$userId" params={{ userId: String(id) }} className="text-neutral-700 hover:text-blue-600 hover:underline">
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
    accessorKey: 'actual_hours',
    header: 'Actual',
    cell: ({ getValue }) => formatHours(getValue() as number),
  },
  {
    accessorKey: 'ratio',
    header: 'Ratio',
    cell: ({ getValue }) => formatRatio(getValue() as number | null),
  },
  {
    accessorKey: 'is_completed',
    header: 'Status',
    cell: ({ getValue }) => ((getValue() as boolean) ? 'Completed' : 'Open'),
  },
  {
    accessorKey: 'created_on',
    header: 'Created',
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
]

export function EstimateVsActualTable({ filters }: { filters: Filters }) {
  const [rows, setRows] = useState<TaskActualVsEstimate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchActualVsEstimate(filters)
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
  }, [filters])

  return <DataTable data={rows} columns={columns} loading={loading} emptyText="No estimated tasks in this slice." />
}
