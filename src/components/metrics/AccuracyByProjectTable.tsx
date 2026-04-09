import { useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import type { Filters } from '@/lib/filters'
import { fetchAccuracyByProject, type EstimateAccuracyByProject } from '@/lib/queries'
import { formatRatio } from '@/lib/format'

const columns: ColumnDef<EstimateAccuracyByProject>[] = [
  { accessorKey: 'project_name', header: 'Project' },
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

export function AccuracyByProjectTable({ filters }: { filters: Filters }) {
  const [rows, setRows] = useState<EstimateAccuracyByProject[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAccuracyByProject(filters)
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

  return <DataTable data={rows} columns={columns} loading={loading} emptyText="No projects with completed tasks." />
}
