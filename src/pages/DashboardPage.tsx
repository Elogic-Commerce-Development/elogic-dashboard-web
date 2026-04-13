import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  fetchGlobalKpis,
  fetchTopOverruns,
  fetchTopUnestimatedWithTime,
  type GlobalKpis,
  type TaskActualVsEstimate,
} from '@/lib/queries'
import { formatHours, formatRatio, acTaskUrl } from '@/lib/format'

function KpiCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'red' | 'amber' | 'emerald' | 'neutral'
}) {
  const colorMap = {
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    neutral: 'border-neutral-200 bg-white text-neutral-900',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs opacity-70">{label}</div>
    </div>
  )
}

export function DashboardPage() {
  const [kpis, setKpis] = useState<GlobalKpis | null>(null)
  const [topOverruns, setTopOverruns] = useState<TaskActualVsEstimate[]>([])
  const [topUnestimated, setTopUnestimated] = useState<TaskActualVsEstimate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchGlobalKpis(), fetchTopOverruns(5), fetchTopUnestimatedWithTime(5)])
      .then(([k, overruns, unest]) => {
        if (cancelled) return
        setKpis(k)
        setTopOverruns(overruns)
        setTopUnestimated(unest)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading dashboard...</div>
  }

  if (!kpis) {
    return <div className="py-12 text-center text-sm text-neutral-400">No data available.</div>
  }

  const adoption = kpis.estimate_adoption_rate != null ? Math.round(kpis.estimate_adoption_rate * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Unestimated tasks with time"
          value={kpis.unestimated_tasks_with_time.toLocaleString()}
          color={kpis.unestimated_tasks_with_time > 0 ? 'red' : 'emerald'}
        />
        <KpiCard
          label="Hours on unestimated"
          value={formatHours(Number(kpis.unestimated_hours))}
          color={Number(kpis.unestimated_hours) > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Overrun tasks"
          value={kpis.overrun_tasks.toLocaleString()}
          color={kpis.overrun_tasks > 0 ? 'red' : 'emerald'}
        />
        <KpiCard
          label="Overrun hours"
          value={formatHours(Number(kpis.overrun_hours))}
          color={Number(kpis.overrun_hours) > 100 ? 'red' : Number(kpis.overrun_hours) > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Estimate adoption"
          value={`${adoption}%`}
          color={adoption >= 50 ? 'emerald' : adoption >= 20 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Total tasks / hours"
          value={`${kpis.total_tasks.toLocaleString()} / ${formatHours(Number(kpis.total_hours))}`}
          color="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ShortlistCard
          title="Worst overruns"
          description="Tasks with the highest overrun ratio."
          viewAllTo="/overview"
          rows={topOverruns}
          renderRow={(row) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    to="/tasks/$taskId"
                    params={{ taskId: String(row.task_id) }}
                    className="truncate text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {row.task_name}
                  </Link>
                  <a
                    href={acTaskUrl(row.project_id, row.task_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-neutral-400 hover:text-neutral-600"
                    title="Open in ActiveCollab"
                  >
                    <ExternalLinkIcon />
                  </a>
                </div>
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: String(row.project_id) }}
                  className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline"
                >
                  {row.project_name}
                </Link>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-sm font-semibold ${
                  (row.ratio ?? 0) >= 2 ? 'text-red-600' : (row.ratio ?? 0) >= 1.5 ? 'text-amber-600' : ''
                }`}>
                  {formatRatio(row.ratio)}
                </span>
                <div className="text-xs text-neutral-400">
                  {formatHours(row.actual_hours)} / {formatHours(row.estimate_hours)}
                </div>
              </div>
            </div>
          )}
        />

        <ShortlistCard
          title="Most hours without estimate"
          description="Unestimated tasks with the most tracked time."
          viewAllTo="/overview"
          rows={topUnestimated}
          renderRow={(row) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    to="/tasks/$taskId"
                    params={{ taskId: String(row.task_id) }}
                    className="truncate text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {row.task_name}
                  </Link>
                  <a
                    href={acTaskUrl(row.project_id, row.task_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-neutral-400 hover:text-neutral-600"
                    title="Open in ActiveCollab"
                  >
                    <ExternalLinkIcon />
                  </a>
                </div>
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: String(row.project_id) }}
                  className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline"
                >
                  {row.project_name}
                </Link>
              </div>
              <div className="shrink-0 text-sm font-semibold text-amber-600">
                {formatHours(row.actual_hours)}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}

function ShortlistCard<T>({
  title,
  description,
  viewAllTo,
  rows,
  renderRow,
}: {
  title: string
  description: string
  viewAllTo: string
  rows: T[]
  renderRow: (row: T, index: number) => React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <Link to={viewAllTo} className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">
          View all
        </Link>
      </div>
      <div className="divide-y divide-neutral-100">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-neutral-400">None found.</div>
        ) : (
          rows.map((row, i) => (
            <div key={i} className="px-4 py-2.5">
              {renderRow(row, i)}
            </div>
          ))
        )}
      </div>
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
