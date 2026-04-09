import { useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import type { Filters } from '@/lib/filters'
import { fetchTasksOverrun, type TaskActualVsEstimate } from '@/lib/queries'
import { formatHours, formatRatio, acTaskUrl } from '@/lib/format'

const columns: ColumnDef<TaskActualVsEstimate>[] = [
  {
    accessorKey: 'task_name',
    header: 'Task',
    cell: ({ row }) => (
      <a
        href={acTaskUrl(row.original.project_id, row.original.task_id)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.task_name}
      </a>
    ),
  },
  { accessorKey: 'project_name', header: 'Project' },
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
    cell: ({ getValue }) => {
      const r = getValue() as number | null
      const pct = formatRatio(r)
      const cls = r != null && r >= 2 ? 'text-red-600 font-medium' : r != null && r >= 1.5 ? 'text-amber-600' : ''
      return <span className={cls}>{pct}</span>
    },
  },
]

export function OverrunTable({ filters }: { filters: Filters }) {
  const [rows, setRows] = useState<TaskActualVsEstimate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTasksOverrun(filters)
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

  return <DataTable data={rows} columns={columns} loading={loading} emptyText="No overrun tasks in this slice." />
}
