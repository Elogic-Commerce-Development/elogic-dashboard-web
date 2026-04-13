import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { fetchTaskContributors, type TaskActualVsEstimate, type TaskContributor } from '@/lib/queries'
import { formatHours, formatRatio, acTaskUrl, acProjectUrl } from '@/lib/format'

export function TaskDetailPage() {
  const { taskId } = useParams({ from: '/tasks/$taskId' })
  const tid = Number(taskId)
  const [task, setTask] = useState<TaskActualVsEstimate | null>(null)
  const [contributors, setContributors] = useState<TaskContributor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const loadTask = supabase
      .from('v_task_actual_vs_estimate')
      .select('*')
      .eq('task_id', tid)
      .maybeSingle()

    Promise.all([loadTask, fetchTaskContributors(tid)])
      .then(([tRes, contribs]) => {
        if (cancelled) return
        if (tRes.data) setTask(tRes.data as TaskActualVsEstimate)
        setContributors(contribs)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tid])

  if (loading) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading task...</div>
  }

  if (!task) {
    return <div className="py-12 text-center text-sm text-neutral-400">Task not found.</div>
  }

  const estimate = task.estimate_hours
  const actual = task.actual_hours
  const overrun = estimate != null ? actual - estimate : null
  const ratio = task.ratio

  // Bar width as percentage of max(estimate, actual)
  const barMax = Math.max(estimate ?? 0, actual)
  const estimatePct = barMax > 0 && estimate != null ? (estimate / barMax) * 100 : 0
  const actualPct = barMax > 0 ? (actual / barMax) * 100 : 0
  const isOverrun = overrun != null && overrun > 0

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
          {task.assignee_name && (
            <>
              <span className="text-neutral-300">|</span>
              <span>Assignee: {task.assignee_name}</span>
            </>
          )}
        </div>
      </div>

      {/* Estimate vs actual bar */}
      {estimate != null && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>Estimate: {formatHours(estimate)}</span>
            <span>Actual: {formatHours(actual)}</span>
          </div>
          <div className="relative h-6 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${isOverrun ? 'bg-red-400' : 'bg-emerald-400'}`}
              style={{ width: `${actualPct}%` }}
            />
            {estimatePct < 100 && (
              <div
                className="absolute inset-y-0 w-0.5 bg-neutral-800"
                style={{ left: `${estimatePct}%` }}
                title={`Estimate: ${formatHours(estimate)}`}
              />
            )}
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className={isOverrun ? 'font-medium text-red-600' : 'text-emerald-600'}>
              {isOverrun ? `+${formatHours(overrun)} overrun` : overrun != null ? `${formatHours(Math.abs(overrun))} under budget` : ''}
            </span>
            {ratio != null && (
              <span className="text-neutral-500">Ratio: {formatRatio(ratio)}</span>
            )}
          </div>
        </div>
      )}

      {estimate == null && actual > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This task has no estimate. {formatHours(actual)} tracked so far.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniCard label="Estimate" value={formatHours(estimate)} />
        <MiniCard label="Actual" value={formatHours(actual)} />
        <MiniCard label="Overrun" value={overrun != null ? formatHours(overrun) : '—'} />
        <MiniCard label="Ratio" value={formatRatio(ratio)} />
      </div>

      {/* Contributor breakdown */}
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
                {contributors.map((c) => (
                  <tr key={c.contributor_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <Link
                        to="/people/$userId"
                        params={{ userId: String(c.contributor_id) }}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {c.contributor_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{formatHours(c.hours)}</td>
                    <td className="px-4 py-2">{formatRatio(c.share)}</td>
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

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-lg font-bold text-neutral-900">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
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
