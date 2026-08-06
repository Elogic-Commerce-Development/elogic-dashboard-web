import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { SourceBadge } from '@/components/SourceBadge'
import { Chip } from '@/components/estimation/Section'
import { BACKLOG_OLD_DAYS, BUS_FACTOR_WARN_PCT, ZOMBIE_BACKLOG_SHARE } from '@/lib/projectPolicy'
import {
  fetchFiringSignalCounts,
  fetchProjectBacklogMap,
  fetchProjectsIndexAllTime,
  fetchProjectsIndexForMonth,
  fetchProjectTeamAllTime,
  fetchProjectTeamForMonth,
  fetchProjectWriteoffMap,
  monthKey,
  type ProjectBacklogStat,
  type ProjectIndexRow,
  type ProjectTeamStat,
} from '@/lib/queries'
import { useFilters } from '@/lib/FilterContext'
import { describeError } from '@/lib/errors'
import { formatHours } from '@/lib/format'
import { WORK_MODEL_LABEL } from '@/lib/radarSignals'
import {
  PERIOD_GROUPS,
  parsePeriodSearch,
  periodRange,
  periodSearchParams,
  type PeriodPreset,
} from '@/lib/period'

/**
 * §4.6's slimmed column set. Two kinds of column, labeled apart:
 *   period-scoped   Hours, Coverage, Team (all time | the selected month)
 *   current-state   Write-off (record grain since 2025), Backlog, Signals —
 *                   "(now)" in the header, identical under every period pill.
 * The §4.6 slim dropped the task/estimated/overrun-count columns; overrun
 * economics live on Estimation and, per project, on the detail page.
 */
type IndexRow = ProjectIndexRow & {
  team: ProjectTeamStat | null
  writeoff: { pct: number | null; flagged: boolean } | null
  backlog: ProjectBacklogStat | null
  signal_count: number | null
}

/** Which decoration columns failed to load — their cells are unmeasured, not zero. */
type FailedColumns = Partial<Record<'team' | 'writeoff' | 'backlog' | 'signals', string>>

function makeColumns(periodActive: boolean, failed: FailedColumns): ColumnDef<IndexRow>[] {
  const failCell = <span className="text-red-400" title="Column failed to load — not measured">×</span>
  return [
    {
      accessorKey: 'project_name',
      header: 'Project',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(row.original.project_id) }}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.project_name}
          </Link>
          <SourceBadge source={row.original.source} />
          <Chip title="Work model — §5's segment tag">
            {WORK_MODEL_LABEL[row.original.work_model] ?? row.original.work_model}
          </Chip>
          {row.original.rate_band ? <Chip title="Rate band (ranking weight only)">Band {row.original.rate_band}</Chip> : null}
          {row.original.is_completed ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              Completed
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'hours',
      header: periodActive ? 'Hours (month)' : 'Hours (all time)',
      cell: ({ getValue }) => formatHours(Number(getValue())),
    },
    {
      accessorKey: 'coverage_pct',
      header: periodActive ? 'Coverage (month)' : 'Coverage',
      cell: ({ row }) => {
        if (!row.original.is_estimating_segment)
          return (
            <span className="text-xs text-neutral-400" title="Estimation metrics do not apply to this segment (§2 “segment or lie”)">
              n/a — {WORK_MODEL_LABEL[row.original.work_model] ?? row.original.work_model}
            </span>
          )
        const v = row.original.coverage_pct
        if (v == null) return '—'
        const cls = v >= 60 ? 'text-emerald-600' : v >= 30 ? 'text-amber-600' : 'text-red-600'
        return <span className={`font-medium ${cls}`}>{Math.round(v)}%</span>
      },
    },
    {
      id: 'team',
      header: periodActive ? 'Team (month)' : 'Team (all time)',
      accessorFn: (r) => r.team?.team_size ?? -1,
      cell: ({ row }) => {
        if (failed.team) return failCell
        const t = row.original.team
        if (!t || t.team_size === 0) return '—'
        return (
          <span className="tabular-nums">
            {t.team_size}
            {t.top_share_pct != null ? (
              <span
                className={`ml-1 text-xs ${t.top_share_pct >= BUS_FACTOR_WARN_PCT ? 'text-amber-600' : 'text-neutral-500'}`}
                title="Top contributor's share of the project's hours — the bus factor"
              >
                · top {Math.round(t.top_share_pct)}%
              </span>
            ) : null}
          </span>
        )
      },
    },
    {
      id: 'writeoff',
      header: 'Write-off (since 2025)',
      accessorFn: (r) => r.writeoff?.pct ?? -1,
      cell: ({ row }) => {
        if (failed.writeoff) return failCell
        if (row.original.source === 'jira')
          return (
            <span className="text-xs text-neutral-400" title="Jira carries no billable flag — untagged, not 0% (§4.4)">
              untagged
            </span>
          )
        const w = row.original.writeoff
        if (!w || w.pct == null) return '—'
        return (
          <span className={w.flagged ? 'font-medium text-red-600' : ''}>
            {w.pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      id: 'backlog',
      header: 'Open backlog (now)',
      accessorFn: (r) => r.backlog?.open_tasks ?? 0,
      cell: ({ row }) => {
        if (failed.backlog) return failCell
        const b = row.original.backlog
        if (!b || b.open_tasks === 0) return <span className="text-neutral-400">0 open</span>
        const zombie = b.open_over_180d > 0 && b.open_over_180d / b.open_tasks >= ZOMBIE_BACKLOG_SHARE
        return (
          <span className="tabular-nums text-xs">
            {b.open_tasks} open
            <span className={zombie ? 'ml-1 font-medium text-amber-600' : 'ml-1 text-neutral-500'}>
              · {b.open_over_180d} older than {BACKLOG_OLD_DAYS}d
            </span>
            {b.age_p50_days != null ? (
              <span className="ml-1 text-neutral-500">· p50 {b.age_p50_days}d</span>
            ) : null}
          </span>
        )
      },
    },
    {
      id: 'signals',
      header: 'Signals (now)',
      accessorFn: (r) => r.signal_count ?? 0,
      cell: ({ row }) => {
        if (failed.signals) return failCell
        const n = row.original.signal_count ?? 0
        if (n === 0) return <span className="text-neutral-400">—</span>
        return (
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(row.original.project_id) }}
            className="font-medium text-red-600 hover:underline"
            title="Firing Radar signals — the detail page names them"
          >
            {n} firing
          </Link>
        )
      },
    },
  ]
}

export function ProjectsPage() {
  const search = useSearch({ from: '/projects' })
  const navigate = useNavigate()
  const { filters } = useFilters()
  const [rows, setRows] = useState<ProjectIndexRow[]>([])
  const [team, setTeam] = useState<Map<number, ProjectTeamStat> | null>(null)
  const [writeoff, setWriteoff] = useState<Map<number, { pct: number | null; flagged: boolean }> | null>(null)
  const [backlog, setBacklog] = useState<Map<number, ProjectBacklogStat> | null>(null)
  const [signals, setSignals] = useState<Map<number, number> | null>(null)
  const [loading, setLoading] = useState(false)
  const [coreError, setCoreError] = useState<string | null>(null)
  const [failed, setFailed] = useState<FailedColumns>({})
  const [showCompleted, setShowCompleted] = useState(false)

  // Validated against the group, not read raw — a bookmark carrying a preset
  // this grid doesn't offer falls back to the default.
  const preset: PeriodPreset =
    parsePeriodSearch(search, PERIOD_GROUPS.grid) ?? PERIOD_GROUPS.grid.default
  const isAllTime = preset === 'all_time'
  const month = useMemo(
    () => (isAllTime ? null : monthKey(periodRange(preset).from)),
    [isAllTime, preset],
  )

  function setPeriod(next: PeriodPreset) {
    navigate({ to: '/projects', search: () => periodSearchParams(next, PERIOD_GROUPS.grid) })
  }

  // This page filters by projects only; filters.userIds is deliberately
  // ignored (the Users select is hidden here).
  const { projectIds } = filters

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setCoreError(null)
      setFailed({})

      // Core rows plus four independent decorations. A decoration failure must
      // not blank the table — but it must not read as zeros either (F3's
      // lesson), so each failure is named in a banner and its cells render ×.
      const [core, teamRes, woRes, backlogRes, sigRes] = await Promise.allSettled([
        month ? fetchProjectsIndexForMonth(month, projectIds) : fetchProjectsIndexAllTime(projectIds),
        month ? fetchProjectTeamForMonth(month, projectIds) : fetchProjectTeamAllTime(projectIds),
        fetchProjectWriteoffMap(projectIds),
        fetchProjectBacklogMap(projectIds),
        fetchFiringSignalCounts(projectIds),
      ])
      if (cancelled) return

      if (core.status === 'fulfilled') setRows(core.value)
      else {
        setRows([])
        setCoreError(describeError(core.reason))
      }
      const fails: FailedColumns = {}
      if (teamRes.status === 'fulfilled') setTeam(teamRes.value)
      else { setTeam(null); fails.team = describeError(teamRes.reason) }
      if (woRes.status === 'fulfilled') setWriteoff(woRes.value)
      else { setWriteoff(null); fails.writeoff = describeError(woRes.reason) }
      if (backlogRes.status === 'fulfilled') setBacklog(backlogRes.value)
      else { setBacklog(null); fails.backlog = describeError(backlogRes.reason) }
      if (sigRes.status === 'fulfilled') setSignals(sigRes.value)
      else { setSignals(null); fails.signals = describeError(sigRes.reason) }
      setFailed(fails)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [month, projectIds])

  const merged = useMemo<IndexRow[]>(
    () =>
      rows.map((r) => ({
        ...r,
        team: team?.get(r.project_id) ?? null,
        writeoff: writeoff?.get(r.project_id) ?? null,
        backlog: backlog?.get(r.project_id) ?? { open_tasks: 0, open_over_180d: 0, age_p50_days: null },
        signal_count: signals?.get(r.project_id) ?? 0,
      })),
    [rows, team, writeoff, backlog, signals],
  )

  // Default to active projects only; the toggle reveals completed ones.
  const visibleRows = useMemo(
    () => (showCompleted ? merged : merged.filter((r) => !r.is_completed)),
    [merged, showCompleted],
  )
  const completedCount = useMemo(() => merged.filter((r) => r.is_completed).length, [merged])

  const columns = useMemo(() => makeColumns(!isAllTime, failed), [isAllTime, failed])
  const failedNames = Object.keys(failed)

  return (
    <div className="space-y-3">
      <PeriodSwitcher preset={preset} group={PERIOD_GROUPS.grid} onChange={setPeriod} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Projects</h2>
          <p className="max-w-4xl text-xs text-neutral-500">
            The browse path into the 65-project scope (tasks created since 2025-01-01) — and the
            home of the T&amp;M / outstaff story: hours, staffing continuity, billability. Hours,
            coverage and team follow the period pill; columns marked “(now)” or “(since 2025)” are
            current-state and do not. Coverage is hours-weighted and applies only to estimating
            segments.
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

      {coreError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">The project list could not be loaded.</span> Nothing below
          was measured — this is not an empty portfolio. <code className="text-xs">{coreError}</code>
        </div>
      ) : (
        <>
          {failedNames.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              <span className="font-medium">
                {failedNames.length === 1 ? 'One column' : `${failedNames.length} columns`} failed to
                load ({failedNames.join(', ')}).
              </span>{' '}
              Cells marked × were not measured — they are not zeros.{' '}
              <code>{Object.values(failed)[0]}</code>
            </div>
          ) : null}
          <DataTable
            data={visibleRows}
            columns={columns}
            loading={loading}
            emptyText={month ? 'No project logged hours in this month.' : 'No project data found.'}
          />
        </>
      )}
    </div>
  )
}
