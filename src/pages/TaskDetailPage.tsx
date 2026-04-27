import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import {
  fetchTaskContributors,
  fetchTaskTimeRecordEntries,
  type TaskActualVsEstimate,
  type TaskContributor,
  type TaskTimeEntry,
} from '@/lib/queries'
import { formatHours, formatRatio, acTaskUrl, acProjectUrl } from '@/lib/format'
import { buildEmployeeColorMap } from '@/lib/contributorColors'
import { TaskTimeBreakdown } from '@/components/TaskTimeBreakdown'
import { TaskTimeEntries } from '@/components/TaskTimeEntries'

export function TaskDetailPage() {
  const { taskId } = useParams({ from: '/tasks/$taskId' })
  const tid = Number(taskId)
  const [task, setTask] = useState<TaskActualVsEstimate | null>(null)
  const [contributors, setContributors] = useState<TaskContributor[]>([])
  const [entries, setEntries] = useState<TaskTimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const loadTask = supabase
      .from('v_task_actual_vs_estimate')
      .select('*')
      .eq('task_id', tid)
      .maybeSingle()

    Promise.all([loadTask, fetchTaskContributors(tid), fetchTaskTimeRecordEntries(tid)])
      .then(([tRes, contribs, ents]) => {
        if (cancelled) return
        if (tRes.data) setTask(tRes.data as TaskActualVsEstimate)
        setContributors(contribs)
        setEntries(ents)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tid])

  // Stable per-task colour map shared by the chart and the entries table
  // so the same person reads as the same shade in both places.
  const employeeColors = useMemo(
    () => buildEmployeeColorMap(entries.map((e) => ({ user_id: e.user_id, hours: e.hours }))),
    [entries],
  )

  if (loading) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading task...</div>
  }

  if (!task) {
    return <div className="py-12 text-center text-sm text-neutral-400">Task not found.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{task.task_name}</h2>
          <a
            href={acTaskUrl(task.project_id, task.task_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-neutral-600"
            title="Open in ActiveCollab"
          >
            <ExternalLinkIcon />
          </a>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            task.is_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
          }`}>
            {task.is_completed ? 'Completed' : 'Open'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(task.project_id) }}
            className="hover:text-blue-600 hover:underline"
          >
            {task.project_name}
          </Link>
          <a
            href={acProjectUrl(task.project_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-neutral-600"
          >
            <ExternalLinkIcon />
          </a>
          {task.assignee_name && task.assignee_id && (
            <>
              <span className="text-neutral-300">|</span>
              <span>
                Assignee:{' '}
                <Link
                  to="/people/$userId"
                  params={{ userId: String(task.assignee_id) }}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {task.assignee_name}
                </Link>
              </span>
            </>
          )}
          {task.ratio != null && (
            <>
              <span className="text-neutral-300">|</span>
              <span>Ratio: <span className="tabular-nums">{formatRatio(task.ratio)}</span></span>
            </>
          )}
        </div>
      </div>

      <TaskTimeBreakdown
        estimate={task.estimate_hours}
        actual={Number(task.actual_hours)}
        entries={entries}
        employeeColors={employeeColors}
      />

      {task.estimate_hours == null && Number(task.actual_hours) > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This task has no estimate. {formatHours(Number(task.actual_hours))} tracked so far.
        </div>
      )}

      {/* Contributor table — kept for the per-person Share% column */}
      {contributors.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">
            Contributors ({contributors.length})
          </h3>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Hours</th>
                  <th className="px-4 py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c) => {
                  const personColor = employeeColors.get(c.contributor_id) ?? '#475569'
                  return (
                    <tr key={c.contributor_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: personColor }}
                          />
                          <Link
                            to="/people/$userId"
                            params={{ userId: String(c.contributor_id) }}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {c.contributor_name}
                          </Link>
                        </span>
                      </td>
                      <td className="px-4 py-2 tabular-nums">{formatHours(c.hours)}</td>
                      <td className="px-4 py-2 tabular-nums">{formatRatio(c.share)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TaskTimeEntries entries={entries} employeeColors={employeeColors} />
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
