import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import {
  fetchPersonMetricsAllTime,
  fetchPersonMetricsForMonth,
  monthKey,
  type PersonMetricRow,
} from '@/lib/queries'
import { useFilters } from '@/lib/FilterContext'
import { formatHours } from '@/lib/format'
import {
  PERIOD_GROUPS,
  parsePeriodSearch,
  periodRange,
  periodSearchParams,
  type PeriodPreset,
} from '@/lib/period'

/**
 * Overrun changes basis with the period, so the header says which one is on
 * screen rather than letting the number jump silently:
 *
 *   all time  §5 attribution — the overrun *amount* (actual − estimate) on
 *             tasks where this person holds ≥ 40% of the hours;
 *   month     contribution — this person's own hours on tasks that overran.
 */
function makeColumns(periodActive: boolean): ColumnDef<PersonMetricRow>[] {
  return [
    {
      accessorKey: 'display_name',
      header: 'Contributor',
      cell: ({ row }) => (
        <Link
          to="/people/$userId"
          params={{ userId: String(row.original.user_id) }}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {row.original.display_name}
        </Link>
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

export function PeoplePage() {
  const search = useSearch({ from: '/people' })
  const navigate = useNavigate()
  const { filters } = useFilters()
  const [rows, setRows] = useState<PersonMetricRow[]>([])
  const [loading, setLoading] = useState(false)

  // Validated against the group, not read raw: this grid offers three presets,
  // so a bookmark carrying `?period=custom` (or a pre-F2 `?period=6m`) has to
  // fall back to the default rather than resolve to a month it never meant.
  const preset: PeriodPreset =
    parsePeriodSearch(search, PERIOD_GROUPS.grid) ?? PERIOD_GROUPS.grid.default
  const isAllTime = preset === 'all_time'
  // One calendar month per non-all-time preset, by construction of the group.
  const month = useMemo(
    () => (isAllTime ? null : monthKey(periodRange(preset).from)),
    [isAllTime, preset],
  )

  function setPeriod(next: PeriodPreset) {
    navigate({ to: '/people', search: () => periodSearchParams(next, PERIOD_GROUPS.grid) })
  }

  // This page filters by people only; filters.projectIds is deliberately
  // ignored (the Projects select is hidden here).
  const { userIds } = filters

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await (month
          ? fetchPersonMetricsForMonth(month, userIds)
          : fetchPersonMetricsAllTime(userIds))
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
  }, [month, userIds])

  const columns = useMemo(() => makeColumns(!isAllTime), [isAllTime])

  return (
    <div className="space-y-3">
      <PeriodSwitcher preset={preset} group={PERIOD_GROUPS.grid} onChange={setPeriod} />
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Contributors (by time tracking)</h2>
        <p className="text-xs text-neutral-500">
          The 65 client-delivery projects, tasks created since 2025-01-01 — the dashboard's own
          scope, not the whole company. A person appears if they logged at least one time entry;
          duplicate accounts are merged into one row. Coverage is the share of their hours on
          estimated tasks.{' '}
          {isAllTime
            ? 'Overrun is the amount by which actuals passed the estimate, charged to whoever holds ≥40% of a task’s hours.'
            : 'In a single month, overrun counts tasks the person touched that overran, and the hours they logged on them.'}
        </p>
      </div>
      <DataTable data={rows} columns={columns} loading={loading} emptyText="No contributor data found." />
    </div>
  )
}
