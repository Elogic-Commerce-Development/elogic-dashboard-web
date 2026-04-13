import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { supabase } from '@/lib/supabase'
import type { TaskActualVsEstimate } from '@/lib/queries'
import { formatHours, formatRatio, acProjectUrl, acTaskUrl } from '@/lib/format'

type ProjectInfo = { id: number; name: string; is_completed: boolean }

const taskColumns: ColumnDef<TaskActualVsEstimate>[] = [
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
      const cls = r != null && r >= 2 ? 'text-red-600 font-medium' : r != null && r >= 1.5 ? 'text-amber-600' : ''
      return <span className={cls}>{formatRatio(r)}</span>
    },
  },
  {
    accessorKey: 'is_completed',
    header: 'Status',
    cell: ({ getValue }) => (getValue() ? 'Completed' : 'Open'),
  },
]

export function ProjectDetailPage() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const pid = Number(projectId)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [tasks, setTasks] = useState<TaskActualVsEstimate[]>([])
  const [contributors, setContributors] = useState<{ contributor_id: number; contributor_name: string; hours: number; tasks: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const loadProject = supabase
      .from('projects')
      .select('id, name, is_completed')
      .eq('id', pid)
      .maybeSingle()

    const loadTasks = supabase
      .from('v_task_actual_vs_estimate')
      .select('*')
      .eq('project_id', pid)
      .order('created_on', { ascending: false })
      .limit(500)

    const loadContributors = supabase
      .from('v_contributor_task_summary')
      .select('contributor_id, contributor_name, contributor_hours, task_id')
      .eq('project_id', pid)

    Promise.all([loadProject, loadTasks, loadContributors])
      .then(([pRes, tRes, cRes]) => {
        if (cancelled) return
        if (pRes.data) setProject(pRes.data as ProjectInfo)
        setTasks((tRes.data ?? []) as TaskActualVsEstimate[])

        // Aggregate contributor rows
        const map = new Map<number, { contributor_id: number; contributor_name: string; hours: number; tasks: Set<number> }>()
        for (const r of (cRes.data ?? []) as { contributor_id: number; contributor_name: string; contributor_hours: number; task_id: number }[]) {
          const existing = map.get(r.contributor_id)
          if (existing) {
            existing.hours += Number(r.contributor_hours)
            existing.tasks.add(r.task_id)
          } else {
            map.set(r.contributor_id, { contributor_id: r.contributor_id, contributor_name: r.contributor_name, hours: Number(r.contributor_hours), tasks: new Set([r.task_id]) })
          }
        }
        setContributors(
          Array.from(map.values())
            .map(({ tasks: taskSet, ...rest }) => ({ ...rest, tasks: taskSet.size }))
            .sort((a, b) => b.hours - a.hours)
        )
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [pid])

  if (loading) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading project...</div>
  }

  if (!project) {
    return <div className="py-12 text-center text-sm text-neutral-400">Project not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{project.name}</h2>
        <a
          href={acProjectUrl(project.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 hover:text-neutral-600"
          title="Open in ActiveCollab"
        >
          <ExternalLinkIcon />
        </a>
        {project.is_completed && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Completed</span>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">Tasks ({tasks.length})</h3>
        <DataTable data={tasks} columns={taskColumns} loading={false} emptyText="No tasks in this project." />
      </section>

      {contributors.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Contributors ({contributors.length})</h3>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Hours</th>
                  <th className="px-4 py-2 font-medium">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c) => (
                  <tr key={c.contributor_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <Link to="/people/$userId" params={{ userId: String(c.contributor_id) }} className="text-blue-600 hover:text-blue-800 hover:underline">
                        {c.contributor_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{formatHours(c.hours)}</td>
                    <td className="px-4 py-2">{c.tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
