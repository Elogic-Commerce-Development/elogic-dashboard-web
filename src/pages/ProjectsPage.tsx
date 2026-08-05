import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import {
  fetchProjectMetricsAllTime,
  fetchProjectMetricsForMonth,
  monthKey,
  type ProjectMetricRow,
} from '@/lib/queries'
import { useFilters } from '@/lib/FilterContext'
import { formatHours } from '@/lib/format'
import {
  PERIOD_GROUPS,
  periodRange,
  periodSearchParams,
  type PeriodPreset,
} from '@/lib/period'
import { SourceBadge } from '@/components/SourceBadge'

/** Overrun changes basis with the period — see PeoplePage's note. */
function makeColumns(periodActive: boolean): ColumnDef<ProjectMetricRow>[] {
  return [
    {
      accessorKey: 'project_name',
      header: 'Project Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(row.original.project_id) }}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.project_name}
          </Link>
          <SourceBadge source={row.original.source} />
        </div>
      ),
    },
    {
      accessorKey: 'hours',
      header: 'Total hours',
      cell: ({ getValue }) => formatHours(Number(getValue())),
    },
    { accessorKey: 'tasks', header: 'Tasks' },
    { accessorKey: 'estimated_tasks', header: 'Estimated' },
    {
      accessorKey: 'coverage_pct',
      header: 'Coverage',
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        if (v == null) return '—'
        const cls = v >= 60 ? 'text-emerald-600' : v >= 30 ? 'text-amber-600' : 'text-red-600'
        return <span className={`font-medium ${cls}`}>{Math.round(v)}%</span>
      },
    },
    {
      accessorKey: 'overrun_tasks',
      header: periodActive ? 'Overrun tasks (touched)' : 'Overrun tasks',
      cell: ({ getValue }) => {
        const v = getValue() as number
        return <span className={v > 0 ? 'text-red-600 font-medium' : ''}>{v}</span>
      },
    },
    {
      accessorKey: 'overrun_hours',
      header: periodActive ? 'Hours on overrun' : 'Overrun hours',
      cell: ({ getValue }) => formatHours(Number(getValue())),
    },
  ]
}

export function ProjectsPage() {
  const search = useSearch({ from: '/projects' })
  const navigate = useNavigate()
  const { filters } = useFilters()
  const [rows, setRows] = useState<ProjectMetricRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const preset: PeriodPreset = search.period ?? PERIOD_GROUPS.grid.default
  const isAllTime = preset === 'all_time'
  const month = useMemo(
    () => (isAllTime ? null : monthKey(periodRange(preset).from)),
    [isAllTime, preset],
  )

  function setPeriod(next: PeriodPreset) {
    navigate({ to: '/projects', search: () => periodSearchParams(next, PERIOD_GROUPS.grid) })
  }

  // Default to active projects only; the toggle reveals completed ones.
  const visibleRows = useMemo(
    () => (showCompleted ? rows : rows.filter((r) => !r.is_completed)),
    [rows, showCompleted],
  )
  const completedCount = useMemo(() => rows.filter((r) => r.is_completed).length, [rows])

  // This page filters by projects only; filters.userIds is deliberately
  // ignored (the Users select is hidden here).
  const { projectIds } = filters

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await (month
          ? fetchProjectMetricsForMonth(month, projectIds)
          : fetchProjectMetricsAllTime(projectIds))
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [month, projectIds])

  const columns = useMemo(() => makeColumns(!isAllTime), [isAllTime])

  return (
    <div className="space-y-3">
      <PeriodSwitcher preset={preset} group={PERIOD_GROUPS.grid} onChange={setPeriod} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Projects (by time tracking)</h2>
          <p className="text-xs text-neutral-500">
            The 65 client-delivery projects, tasks created since 2025-01-01 — the dashboard's own
            scope, not the whole company. Coverage is the share of the project's hours on estimated
            tasks.{' '}
            {isAllTime
              ? 'Overrun is gross: realized plus live, never netted against underrun, with container “bucket” tasks excluded.'
              : 'In a single month, overrun counts tasks touched that month which overran, and the hours logged on them.'}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-blue-600"
          />
          Show completed{completedCount > 0 ? ` (${completedCount})` : ''}
        </label>
      </div>
      <DataTable data={visibleRows} columns={columns} loading={loading} emptyText="No project data found." />
    </div>
  )
}
