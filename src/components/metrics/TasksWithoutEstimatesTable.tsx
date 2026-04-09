import { useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import type { Filters } from '@/lib/filters'
import { fetchTasksWithoutEstimates, type TaskWithoutEstimate } from '@/lib/queries'
import { formatDate, acTaskUrl } from '@/lib/format'

const columns: ColumnDef<TaskWithoutEstimate>[] = [
  {
    accessorKey: 'name',
    header: 'Task',
    cell: ({ row }) => (
      <a
        href={acTaskUrl(row.original.project_id, row.original.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.name}
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
    accessorKey: 'created_on',
    header: 'Created',
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
  {
    accessorKey: 'due_on',
    header: 'Due',
    cell: ({ getValue }) => formatDate(getValue() as string | null),
  },
]

export function TasksWithoutEstimatesTable({ filters }: { filters: Filters }) {
  const [rows, setRows] = useState<TaskWithoutEstimate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTasksWithoutEstimates(filters)
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

  return <DataTable data={rows} columns={columns} loading={loading} emptyText="Every open task has an estimate." />
}
