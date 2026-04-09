import { useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import type { Filters } from '@/lib/filters'
import { fetchAccuracyByUser, type EstimateAccuracyByUser } from '@/lib/queries'
import { formatRatio } from '@/lib/format'

const columns: ColumnDef<EstimateAccuracyByUser>[] = [
  {
    accessorKey: 'assignee_name',
    header: 'User',
    cell: ({ getValue }) => (getValue() as string | null) ?? '—',
  },
  { accessorKey: 'total_tasks', header: 'Total tasks' },
  { accessorKey: 'estimated_tasks', header: 'Estimated' },
  {
    id: 'adoption',
    header: 'Adoption',
    cell: ({ row }) => {
      const r = row.original
      if (r.total_tasks === 0) return '—'
      return formatRatio(r.estimated_tasks / r.total_tasks)
    },
  },
  {
    accessorKey: 'mean_ratio',
    header: 'Mean ratio',
    cell: ({ getValue }) => formatRatio(getValue() as number | null),
  },
  {
    accessorKey: 'median_ratio',
    header: 'Median ratio',
    cell: ({ getValue }) => formatRatio(getValue() as number | null),
  },
]

export function AccuracyByUserTable({ filters }: { filters: Filters }) {
  const [rows, setRows] = useState<EstimateAccuracyByUser[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAccuracyByUser(filters)
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

  return <DataTable data={rows} columns={columns} loading={loading} emptyText="No users with completed tasks." />
}
