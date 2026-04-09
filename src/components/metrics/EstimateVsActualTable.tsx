import { useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import type { Filters } from '@/lib/filters'
import { fetchActualVsEstimate, type TaskActualVsEstimate } from '@/lib/queries'
import { formatHours, formatRatio, formatDate } from '@/lib/format'

const columns: ColumnDef<TaskActualVsEstimate>[] = [
  { accessorKey: 'task_name', header: 'Task' },
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
