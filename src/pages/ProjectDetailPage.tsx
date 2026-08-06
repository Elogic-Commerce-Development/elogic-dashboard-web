import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Accordion } from '@/components/Accordion'
import { DataTable } from '@/components/DataTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { QaRate } from '@/components/QaRate'
import { SourceBadge } from '@/components/SourceBadge'
import { SignalBanner } from '@/components/projects/SignalBanner'
import { BacklogFlowChart } from '@/components/projects/BacklogFlowChart'
import { ProjectTrendChart } from '@/components/projects/ProjectTrendChart'
import { Chip, Loading, Panel, StatTile } from '@/components/estimation/Section'
import { supabase } from '@/lib/supabase'
import {
  fetchProjectBulkCloseDays,
  fetchProjectContribRows,
  fetchProjectFlowRows,
  fetchProjectMonthSeries,
  fetchProjectPeriodRows,
  fetchProjectSignalsRow,
  fetchProjectTasks,
  fetchUserNames,
  type BulkCloseDay,
  type ProjectContribRow,
  type ProjectFlowRow,
  type ProjectMonthRow,
  type ProjectPeriodRow,
  type ProjectSignals,
  type ProjectTaskRow,
} from '@/lib/queries'
import { describeError } from '@/lib/errors'
import { formatHours, externalProjectLink, externalTaskLink } from '@/lib/format'
import { WORK_MODEL_LABEL } from '@/lib/radarSignals'
import { BUS_FACTOR_WARN_PCT } from '@/lib/projectPolicy'
import { PERIOD_GROUPS, enumerateMonths, periodRange, periodSearchParams, type PeriodPreset } from '@/lib/period'

type ProjectInfo = {
  id: number
  name: string
  is_completed: boolean
  source: string | null
  jira_key: string | null
}

/**
 * Click-to-filter keys. The all-time set mirrors the §5 vocabulary the KPI
 * cards use (every predicate is a `v_metric_tasks` boolean, only counted
 * here); the period set works on task-lifetime facts carried by the S7 rows.
 */
type TaskFilter =
  | 'all'
  | 'unestimated'
  | 'open-unestimated-active'
  | 'overrun-realized'
  | 'overrun-live'
  | 'approaching'
  | 'overrun-touched'

/** One task of the period table — S7 rows collapsed to task grain. */
type PeriodTaskRow = {
  task_id: number
  task_name: string
  assignee_id: number | null
  source: string | null
  task_jira_key: string | null
  period_hours: number
  estimate_hours: number | null
  actual_hours: number
  ratio: number | null
  is_estimated: boolean
  is_completed: boolean
  overrun_hours: number
  is_live_overrun: boolean
  qa_iterations: number | null
  qa_bugs: number | null
}

/** One contributor row — either grain, same columns as the table has always had. */
type ContributorStat = {
  user_id: number
  display_name: string
  hours: number
  tasks: number
  overrun_tasks: number
  hours_on_overrun: number
  avg_qa_bugs: number | null
  qa_bugs_tasks: number
  avg_qa_iterations: number | null
  qa_iterations_tasks: number
}

function ratioCell(ratio: number | null) {
  if (ratio == null) return '—'
  const pct = Math.round(ratio * 100)
  const cls = ratio >= 2 ? 'text-red-600 font-semibold' : ratio >= 1.5 ? 'text-amber-600 font-medium' : ''
  return <span className={cls}>{pct}%</span>
}

function overrunCell(overrun: number, isEstimated: boolean) {
  if (!isEstimated) return '—'
  if (overrun <= 0) return <span className="text-emerald-600">—</span>
  return <span className="font-medium text-red-600">+{formatHours(overrun)}</span>
}

function taskNameCell(t: {
  task_id: number
  task_name: string
  source: string | null
  task_jira_key: string | null
}, projectId: number) {
  const ext = externalTaskLink({
    source: t.source,
    projectId,
    taskId: t.task_id,
    taskJiraKey: t.task_jira_key,
  })
  return (
    <div className="flex items-center gap-1.5">
      <Link
        to="/tasks/$taskId"
        params={{ taskId: String(t.task_id) }}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {t.task_name}
      </Link>
      <SourceBadge source={t.source} />
      <a
        href={ext.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-neutral-400 hover:text-neutral-600"
        title={ext.label}
      >
        <ExternalLinkIcon />
      </a>
    </div>
  )
}

function assigneeCell(id: number | null, names: Map<number, string>) {
  if (id == null) return '—'
  const name = names.get(id)
  return (
    <Link
      to="/people/$userId"
      params={{ userId: String(id) }}
      className="text-blue-600 hover:text-blue-800 hover:underline"
    >
      {name ?? `#${id}`}
    </Link>
  )
}

function makeAllTimeColumns(projectId: number, names: Map<number, string>): ColumnDef<ProjectTaskRow>[] {
  return [
    { accessorKey: 'task_name', header: 'Task', cell: ({ row }) => taskNameCell(row.original, projectId) },
    { accessorKey: 'assignee_id', header: 'Assignee', cell: ({ row }) => assigneeCell(row.original.assignee_id, names) },
    {
      accessorKey: 'estimate_hours',
      header: 'Estimate',
      cell: ({ getValue }) => formatHours(getValue() as number | null),
    },
    { accessorKey: 'actual_hours', header: 'Actual', cell: ({ getValue }) => formatHours(getValue() as number) },
    { accessorKey: 'ratio', header: 'Ratio', cell: ({ row }) => ratioCell(row.original.ratio) },
    {
      id: 'overrun',
      header: 'Overrun',
      accessorFn: (r) => r.overrun_hours,
      cell: ({ row }) => overrunCell(row.original.overrun_hours, row.original.is_estimated),
    },
    { accessorKey: 'is_completed', header: 'Status', cell: ({ getValue }) => (getValue() ? 'Completed' : 'Open') },
  ]
}

function makePeriodColumns(projectId: number, names: Map<number, string>): ColumnDef<PeriodTaskRow>[] {
  return [
    { accessorKey: 'task_name', header: 'Task', cell: ({ row }) => taskNameCell(row.original, projectId) },
    { accessorKey: 'assignee_id', header: 'Assignee', cell: ({ row }) => assigneeCell(row.original.assignee_id, names) },
    {
      accessorKey: 'estimate_hours',
      header: 'Estimate (all time)',
      cell: ({ getValue }) => formatHours(getValue() as number | null),
    },
    {
      accessorKey: 'period_hours',
      header: 'Hours (period)',
      cell: ({ getValue }) => formatHours(getValue() as number),
    },
    {
      accessorKey: 'actual_hours',
      header: 'Actual (all time)',
      cell: ({ getValue }) => formatHours(getValue() as number),
    },
    { accessorKey: 'ratio', header: 'Ratio (all time)', cell: ({ row }) => ratioCell(row.original.ratio) },
    {
      id: 'overrun',
      header: 'Overrun (all time)',
      accessorFn: (r) => r.overrun_hours,
      cell: ({ row }) => overrunCell(row.original.overrun_hours, row.original.is_estimated),
    },
    { accessorKey: 'is_completed', header: 'Status', cell: ({ getValue }) => (getValue() ? 'Completed' : 'Open') },
  ]
}

function KpiCard({
  label,
  value,
  sub,
  color,
  active,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  color: 'red' | 'amber' | 'orange' | 'emerald' | 'blue' | 'neutral'
  active?: boolean
  onClick?: () => void
}) {
  const colorMap = {
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    orange: 'border-orange-200 bg-orange-50 text-orange-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    neutral: 'border-neutral-200 bg-white text-neutral-900',
  }
  const activeRing = active ? 'ring-2 ring-offset-1 ring-neutral-900' : ''
  const clickable = onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${colorMap[color]} ${activeRing} ${clickable}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs opacity-70">{label}</div>
      {sub && <div className="mt-0.5 text-xs font-medium opacity-60">{sub}</div>}
    </div>
  )
}

export function ProjectDetailPage() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const search = useSearch({ from: '/projects/$projectId' })
  const navigate = useNavigate()
  const pid = Number(projectId)

  const activePreset: PeriodPreset = search.period ?? PERIOD_GROUPS.project.default
  const isAllTime = activePreset === 'all_time'
  // Month-aligned by construction (the project group offers no week/custom
  // presets) — the S7 rows for these months are the period-mode source.
  const months = useMemo(
    () => (isAllTime ? [] : enumerateMonths(periodRange(activePreset))),
    [isAllTime, activePreset],
  )
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Static bundle — per-project facts that do not depend on the period pill.
  const [signalsRow, setSignalsRow] = useState<ProjectSignals | null>(null)
  const [signalsLoaded, setSignalsLoaded] = useState(false)
  const [contribRows, setContribRows] = useState<ProjectContribRow[] | null>(null)
  const [monthSeries, setMonthSeries] = useState<ProjectMonthRow[] | null>(null)
  const [flowRows, setFlowRows] = useState<ProjectFlowRow[] | null>(null)
  const [bulkDays, setBulkDays] = useState<BulkCloseDay[] | null>(null)
  const [staticErrors, setStaticErrors] = useState<Partial<Record<'signals' | 'contributors' | 'trend' | 'flow', string>>>({})

  // Mode data — the grain the period pill selects.
  const [tasks, setTasks] = useState<ProjectTaskRow[]>([])
  const [periodRows, setPeriodRows] = useState<ProjectPeriodRow[]>([])
  const [names, setNames] = useState<Map<number, string>>(new Map())
  const [modeLoading, setModeLoading] = useState(true)
  const [modeError, setModeError] = useState<string | null>(null)

  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [tasksOpen, setTasksOpen] = useState(false)
  const [contributorsOpen, setContributorsOpen] = useState(false)

  // Reset the task filter when the project or period changes (previous-key
  // render pattern, so the reset lands before paint).
  const taskFilterKey = `${pid}|${activePreset}`
  const [prevTaskFilterKey, setPrevTaskFilterKey] = useState(taskFilterKey)
  if (taskFilterKey !== prevTaskFilterKey) {
    setPrevTaskFilterKey(taskFilterKey)
    setTaskFilter('all')
  }

  useEffect(() => {
    let cancelled = false
    async function loadStatic() {
      setSignalsLoaded(false)
      setStaticErrors({})
      setSignalsRow(null)
      setContribRows(null)
      setMonthSeries(null)
      setFlowRows(null)
      setBulkDays(null)
      setMetaError(null)

      const [meta, sig, contrib, series, flow, bulk] = await Promise.allSettled([
        supabase.from('projects').select('id, name, is_completed, source, jira_key').eq('id', pid).maybeSingle(),
        fetchProjectSignalsRow(pid),
        fetchProjectContribRows(pid),
        fetchProjectMonthSeries(pid),
        fetchProjectFlowRows(pid),
        fetchProjectBulkCloseDays(pid),
      ])
      if (cancelled) return

      if (meta.status === 'fulfilled' && !meta.value.error) setProject((meta.value.data as ProjectInfo | null) ?? null)
      else setMetaError(describeError(meta.status === 'fulfilled' ? meta.value.error : meta.reason))

      const errs: typeof staticErrors = {}
      if (sig.status === 'fulfilled') {
        setSignalsRow(sig.value)
        setSignalsLoaded(true)
      } else errs.signals = describeError(sig.reason)
      if (contrib.status === 'fulfilled') setContribRows(contrib.value)
      else errs.contributors = describeError(contrib.reason)
      if (series.status === 'fulfilled') setMonthSeries(series.value)
      else errs.trend = describeError(series.reason)
      // The flow chart is wrong without its bulk-close exclusion, so either
      // failure fails the section — a mass-close rendering as an organic month
      // is exactly what §5's guard exists to prevent.
      if (flow.status === 'fulfilled' && bulk.status === 'fulfilled') {
        setFlowRows(flow.value)
        setBulkDays(bulk.value)
      } else {
        errs.flow = describeError(flow.status === 'rejected' ? flow.reason : (bulk as PromiseRejectedResult).reason)
      }
      setStaticErrors(errs)
    }
    void loadStatic()
    return () => {
      cancelled = true
    }
  }, [pid])

  useEffect(() => {
    let cancelled = false
    async function loadMode() {
      setModeLoading(true)
      setModeError(null)
      try {
        if (isAllTime) {
          const rows = await fetchProjectTasks(pid)
          if (cancelled) return
          setTasks(rows)
          const nameMap = await fetchUserNames(rows.map((t) => t.assignee_id ?? NaN))
          if (cancelled) return
          setNames(nameMap)
        } else {
          const rows = await fetchProjectPeriodRows(pid, months[0], months[months.length - 1])
          if (cancelled) return
          setPeriodRows(rows)
          const nameMap = await fetchUserNames(rows.map((t) => t.assignee_id ?? NaN))
          if (cancelled) return
          setNames(nameMap)
        }
      } catch (e) {
        if (!cancelled) setModeError(describeError(e))
      } finally {
        if (!cancelled) setModeLoading(false)
      }
    }
    void loadMode()
    return () => {
      cancelled = true
    }
  }, [pid, isAllTime, months])

  function setPeriod(preset: PeriodPreset, customFrom?: string, customTo?: string) {
    navigate({
      to: '/projects/$projectId',
      params: { projectId: String(pid) },
      search: () => periodSearchParams(preset, PERIOD_GROUPS.project, customFrom, customTo),
    })
  }

  /* ── §5 KPI aggregation — counting view booleans, never re-deriving them ── */

  const allTimeMetrics = useMemo(() => {
    const unest = tasks.filter((t) => !t.is_estimated)
    const unestOpen = unest.filter((t) => !t.is_completed)
    const unestOpenActive = unestOpen.filter((t) => t.actual_hours > 0)
    const realized = tasks.filter((t) => t.overrun_realized_hours > 0)
    const realizedH = tasks.reduce((s, t) => s + t.overrun_realized_hours, 0)
    const live = tasks.filter((t) => t.is_live_overrun)
    const liveH = live.reduce((s, t) => s + t.overrun_live_hours, 0)
    const buckets = tasks.filter((t) => t.is_bucket && !t.is_completed)
    const bucketH = buckets.reduce((s, t) => s + t.overrun_hours, 0)
    const approaching = tasks.filter((t) => t.is_approaching)
    return {
      unest: unest.length,
      unestOpen: unestOpen.length,
      unestOpenActive: unestOpenActive.length,
      realizedN: realized.length,
      realizedH,
      liveN: live.length,
      liveH,
      bucketN: buckets.length,
      bucketH,
      approachingN: approaching.length,
    }
  }, [tasks])

  const periodTasks = useMemo<PeriodTaskRow[]>(() => {
    const byTask = new Map<number, PeriodTaskRow>()
    for (const r of periodRows) {
      const acc = byTask.get(r.task_id)
      if (acc) acc.period_hours += r.hours
      else
        byTask.set(r.task_id, {
          task_id: r.task_id,
          task_name: r.task_name,
          assignee_id: r.assignee_id,
          source: r.source,
          task_jira_key: r.task_jira_key,
          period_hours: r.hours,
          estimate_hours: r.estimate_hours,
          actual_hours: r.actual_hours,
          ratio: r.ratio,
          is_estimated: r.is_estimated,
          is_completed: r.is_completed,
          overrun_hours: r.overrun_hours,
          is_live_overrun: r.is_live_overrun,
          qa_iterations: r.qa_iterations,
          qa_bugs: r.qa_bugs,
        })
    }
    return Array.from(byTask.values()).sort((a, b) => b.period_hours - a.period_hours)
  }, [periodRows])

  const periodMetrics = useMemo(() => {
    const hours = periodRows.reduce((s, r) => s + r.hours, 0)
    const unest = periodTasks.filter((t) => !t.is_estimated)
    const over = periodTasks.filter((t) => t.overrun_hours > 0)
    const hoursOnOverrun = over.reduce((s, t) => s + t.period_hours, 0)
    return {
      tasksTouched: periodTasks.length,
      hours,
      unestTouched: unest.length,
      overrunTouched: over.length,
      hoursOnOverrun,
    }
  }, [periodRows, periodTasks])

  const contributors = useMemo<ContributorStat[]>(() => {
    if (isAllTime) {
      if (!contribRows) return []
      const taskById = new Map(tasks.map((t) => [t.task_id, t]))
      const byUser = new Map<number, ContributorStat & { bugsSum: number; iterSum: number }>()
      for (const r of contribRows) {
        let acc = byUser.get(r.user_id)
        if (!acc) {
          acc = {
            user_id: r.user_id,
            display_name: r.display_name,
            hours: 0, tasks: 0, overrun_tasks: 0, hours_on_overrun: 0,
            avg_qa_bugs: null, qa_bugs_tasks: 0, avg_qa_iterations: null, qa_iterations_tasks: 0,
            bugsSum: 0, iterSum: 0,
          }
          byUser.set(r.user_id, acc)
        }
        acc.hours += r.hours
        acc.tasks += 1
        const t = taskById.get(r.task_id)
        if (t) {
          if (t.overrun_hours > 0) {
            acc.overrun_tasks += 1
            acc.hours_on_overrun += r.hours
          }
          if (t.qa_bugs != null) { acc.bugsSum += t.qa_bugs; acc.qa_bugs_tasks += 1 }
          if (t.qa_iterations != null) { acc.iterSum += t.qa_iterations; acc.qa_iterations_tasks += 1 }
        }
      }
      return Array.from(byUser.values())
        .map(({ bugsSum, iterSum, ...rest }) => ({
          ...rest,
          avg_qa_bugs: rest.qa_bugs_tasks > 0 ? bugsSum / rest.qa_bugs_tasks : null,
          avg_qa_iterations: rest.qa_iterations_tasks > 0 ? iterSum / rest.qa_iterations_tasks : null,
        }))
        .sort((a, b) => b.hours - a.hours)
    }
    // Period mode: S7 rows, distinct tasks per person (a task appears once per
    // month it was touched — the DISTINCT is what keeps counts exact).
    const byUser = new Map<number, ContributorStat & { bugsSum: number; iterSum: number; seen: Set<number> }>()
    for (const r of periodRows) {
      let acc = byUser.get(r.user_id)
      if (!acc) {
        acc = {
          user_id: r.user_id,
          display_name: r.display_name,
          hours: 0, tasks: 0, overrun_tasks: 0, hours_on_overrun: 0,
          avg_qa_bugs: null, qa_bugs_tasks: 0, avg_qa_iterations: null, qa_iterations_tasks: 0,
          bugsSum: 0, iterSum: 0, seen: new Set<number>(),
        }
        byUser.set(r.user_id, acc)
      }
      acc.hours += r.hours
      if (r.overrun_hours > 0) acc.hours_on_overrun += r.hours
      if (!acc.seen.has(r.task_id)) {
        acc.seen.add(r.task_id)
        acc.tasks += 1
        if (r.overrun_hours > 0) acc.overrun_tasks += 1
        if (r.qa_bugs != null) { acc.bugsSum += r.qa_bugs; acc.qa_bugs_tasks += 1 }
        if (r.qa_iterations != null) { acc.iterSum += r.qa_iterations; acc.qa_iterations_tasks += 1 }
      }
    }
    return Array.from(byUser.values())
      .map(({ bugsSum, iterSum, seen, ...rest }) => ({
        ...rest,
        tasks: seen.size,
        avg_qa_bugs: rest.qa_bugs_tasks > 0 ? bugsSum / rest.qa_bugs_tasks : null,
        avg_qa_iterations: rest.qa_iterations_tasks > 0 ? iterSum / rest.qa_iterations_tasks : null,
      }))
      .sort((a, b) => b.hours - a.hours)
  }, [isAllTime, contribRows, tasks, periodRows])

  /** All-time bus factor — from the same contributor grain the accordion uses. */
  const busFactor = useMemo(() => {
    if (!contribRows || contribRows.length === 0) return null
    const perUser = new Map<number, { name: string; hours: number }>()
    let total = 0
    for (const r of contribRows) {
      total += r.hours
      const u = perUser.get(r.user_id)
      if (u) u.hours += r.hours
      else perUser.set(r.user_id, { name: r.display_name, hours: r.hours })
    }
    let top: { name: string; hours: number } | null = null
    for (const u of perUser.values()) if (!top || u.hours > top.hours) top = u
    if (!top || total <= 0) return null
    return { teamSize: perUser.size, topName: top.name, topSharePct: (top.hours / total) * 100, totalHours: total }
  }, [contribRows])

  const filteredTasks = useMemo(() => {
    switch (taskFilter) {
      case 'unestimated': return tasks.filter((t) => !t.is_estimated)
      case 'open-unestimated-active': return tasks.filter((t) => !t.is_estimated && !t.is_completed && t.actual_hours > 0)
      case 'overrun-realized': return tasks.filter((t) => t.overrun_realized_hours > 0)
      case 'overrun-live': return tasks.filter((t) => t.is_live_overrun)
      case 'approaching': return tasks.filter((t) => t.is_approaching)
      default: return tasks
    }
  }, [tasks, taskFilter])

  const filteredPeriodTasks = useMemo(() => {
    switch (taskFilter) {
      case 'unestimated': return periodTasks.filter((t) => !t.is_estimated)
      case 'overrun-touched': return periodTasks.filter((t) => t.overrun_hours > 0)
      default: return periodTasks
    }
  }, [periodTasks, taskFilter])

  const allTimeColumns = useMemo(() => makeAllTimeColumns(pid, names), [pid, names])
  const periodColumns = useMemo(() => makePeriodColumns(pid, names), [pid, names])

  const toggleFilter = (f: TaskFilter) => {
    setTaskFilter((prev) => (prev === f ? 'all' : f))
    setTasksOpen(true)
  }

  const outOfScope = signalsLoaded && signalsRow === null
  const shownTaskCount = isAllTime ? filteredTasks.length : filteredPeriodTasks.length
  const totalTaskCount = isAllTime ? tasks.length : periodTasks.length

  if (metaError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span className="font-medium">The project could not be loaded.</span>{' '}
        <code className="text-xs">{metaError}</code>
      </div>
    )
  }
  if (!project) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading project…</div>
  }

  return (
    <div className="space-y-6">
      {/* Header — name, source, external link, work-model + band chips */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{project.name}</h2>
        <SourceBadge source={project.source} />
        <a
          href={externalProjectLink({ source: project.source, projectId: project.id, projectJiraKey: project.jira_key }).url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 hover:text-neutral-600"
          title={externalProjectLink({ source: project.source, projectId: project.id, projectJiraKey: project.jira_key }).label}
        >
          <ExternalLinkIcon />
        </a>
        {signalsRow ? (
          <>
            <Chip title="Work model — §5's segment tag">
              {WORK_MODEL_LABEL[signalsRow.work_model] ?? signalsRow.work_model}
            </Chip>
            {signalsRow.rate_band ? <Chip title="Rate band (ranking weight only)">Band {signalsRow.rate_band}</Chip> : null}
          </>
        ) : null}
        {project.is_completed && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Completed</span>
        )}
      </div>

      {outOfScope ? (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-4 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">Outside the dashboard scope.</p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-neutral-600">
            This project is not one of the 65 outsourcing ∪ Jira projects the canonical metrics
            cover (or it is explicitly excluded from metrics, like the PSP mirror). No §5 numbers
            exist for it, so none are shown — the external link above still opens it at the source.
          </p>
        </div>
      ) : (
        <>
          <SignalBanner signals={signalsRow} loading={!signalsLoaded && !staticErrors.signals} error={staticErrors.signals} />

          <PeriodSwitcher preset={activePreset} group={PERIOD_GROUPS.project} onChange={setPeriod} />

          {/* KPI cards — §5 quantities; a loading or failed fetch must not render zeros */}
          {modeError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="font-medium">Task metrics could not be loaded.</span> Nothing below
              was measured — this is not a clean project. <code className="text-xs">{modeError}</code>
            </div>
          ) : modeLoading ? (
            <Loading what="task metrics" />
          ) : isAllTime ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard
                label="Tasks w/o estimates"
                value={String(allTimeMetrics.unest)}
                sub={`${allTimeMetrics.unestOpen} open`}
                color={allTimeMetrics.unest > 0 ? 'amber' : 'emerald'}
                active={taskFilter === 'unestimated'}
                onClick={() => toggleFilter('unestimated')}
              />
              <KpiCard
                label="Open w/o estimate, active"
                value={String(allTimeMetrics.unestOpenActive)}
                sub="open + tracked time"
                color={allTimeMetrics.unestOpenActive > 0 ? 'orange' : 'emerald'}
                active={taskFilter === 'open-unestimated-active'}
                onClick={() => toggleFilter('open-unestimated-active')}
              />
              <KpiCard
                label="Realized overrun"
                value={formatHours(allTimeMetrics.realizedH)}
                sub={`${allTimeMetrics.realizedN} completed tasks`}
                color={allTimeMetrics.realizedH > 0 ? 'red' : 'emerald'}
                active={taskFilter === 'overrun-realized'}
                onClick={() => toggleFilter('overrun-realized')}
              />
              <KpiCard
                label="Live overrun"
                value={formatHours(allTimeMetrics.liveH)}
                sub={`${allTimeMetrics.liveN} open${allTimeMetrics.bucketN > 0 ? ` · ${allTimeMetrics.bucketN} bucket excl.` : ''}`}
                color={allTimeMetrics.liveH > 0 ? 'red' : 'emerald'}
                active={taskFilter === 'overrun-live'}
                onClick={() => toggleFilter('overrun-live')}
              />
              <KpiCard
                label="Approaching estimate"
                value={String(allTimeMetrics.approachingN)}
                sub="80–100% consumed"
                color={allTimeMetrics.approachingN > 0 ? 'amber' : 'emerald'}
                active={taskFilter === 'approaching'}
                onClick={() => toggleFilter('approaching')}
              />
              <KpiCard
                label="Total tasks"
                value={String(tasks.length)}
                color={taskFilter !== 'all' ? 'blue' : 'neutral'}
                onClick={() => { setTaskFilter('all'); setTasksOpen(true) }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="Tasks touched"
                value={String(periodMetrics.tasksTouched)}
                sub="logged time in the period"
                color={taskFilter !== 'all' ? 'blue' : 'neutral'}
                onClick={() => { setTaskFilter('all'); setTasksOpen(true) }}
              />
              <KpiCard label="Hours logged" value={formatHours(periodMetrics.hours)} color="neutral" />
              <KpiCard
                label="Unestimated (touched)"
                value={String(periodMetrics.unestTouched)}
                sub="no estimate on the task"
                color={periodMetrics.unestTouched > 0 ? 'amber' : 'emerald'}
                active={taskFilter === 'unestimated'}
                onClick={() => toggleFilter('unestimated')}
              />
              <KpiCard
                label="Hours on overrun tasks"
                value={formatHours(periodMetrics.hoursOnOverrun)}
                sub={`${periodMetrics.overrunTouched} tasks over their all-time estimate`}
                color={periodMetrics.hoursOnOverrun > 0 ? 'red' : 'emerald'}
                active={taskFilter === 'overrun-touched'}
                onClick={() => toggleFilter('overrun-touched')}
              />
            </div>
          )}

          {taskFilter !== 'all' && !modeLoading && !modeError && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">
                Filtered: <span className="font-semibold">{shownTaskCount}</span> of {totalTaskCount} tasks
              </span>
              <button
                onClick={() => setTaskFilter('all')}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                Clear filter
              </button>
            </div>
          )}

          {/* §4.7's historical context — each panel owns its window, stated in its blurb */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Project history</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Runway"
                value={
                  signalsRow?.runway_weeks == null
                    ? '—'
                    : `${signalsRow.runway_weeks.toFixed(1)} wk`
                }
                caption={
                  signalsRow
                    ? `${formatHours(signalsRow.open_estimated_runway_hours)} of open estimated work at the trailing 4-week burn${signalsRow.runway_weeks == null ? ' — no burn in the last 4 weeks' : ''}`
                    : 'Radar signals unavailable'
                }
                tone={signalsRow?.sig_backlog_estimation_debt ? 'amber' : 'neutral'}
              />
              <StatTile
                label="Write-off (since 2025)"
                value={
                  project.source === 'jira'
                    ? 'untagged'
                    : signalsRow?.writeoff_pct == null
                      ? '—'
                      : `${signalsRow.writeoff_pct.toFixed(1)}%`
                }
                caption={
                  project.source === 'jira'
                    ? 'Jira carries no billable flag — unanswerable, not 0% (§4.4)'
                    : signalsRow?.writeoff_baseline_pct != null
                      ? `share of AC hours non-billable · trailing 6-month baseline ${signalsRow.writeoff_baseline_pct.toFixed(1)}%`
                      : 'share of AC hours non-billable · no trailing baseline yet'
                }
                tone={signalsRow?.sig_writeoff_drift ? 'amber' : 'neutral'}
              />
              <StatTile
                label="Bus factor (all time)"
                value={busFactor ? `top ${Math.round(busFactor.topSharePct)}%` : '—'}
                caption={
                  busFactor
                    ? `${busFactor.topName} holds ${Math.round(busFactor.topSharePct)}% of ${formatHours(busFactor.totalHours)} · ${busFactor.teamSize} contributors`
                    : staticErrors.contributors
                      ? 'contributor data failed to load'
                      : 'no tracked time on in-scope tasks'
                }
                tone={busFactor && busFactor.topSharePct >= BUS_FACTOR_WARN_PCT ? 'amber' : 'neutral'}
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel
                title="Backlog flow"
                blurb="Tasks created vs completed per month, since 2025. Bulk-close days are counted apart, per §5."
              >
                {staticErrors.flow ? (
                  <div className="px-4 py-3 text-sm text-red-700">
                    Could not be loaded — this is not a flat backlog. <code className="text-xs">{staticErrors.flow}</code>
                  </div>
                ) : flowRows && bulkDays ? (
                  <BacklogFlowChart rows={flowRows} bulkDays={bulkDays} />
                ) : (
                  <div className="px-4 py-6 text-sm text-neutral-400">Loading…</div>
                )}
              </Panel>
              <Panel
                title="Monthly hours & coverage"
                blurb="Hours logged per month, split estimated vs unestimated, with hours-weighted coverage — the same vocabulary as the Estimation page."
              >
                {staticErrors.trend ? (
                  <div className="px-4 py-3 text-sm text-red-700">
                    Could not be loaded — not an idle project. <code className="text-xs">{staticErrors.trend}</code>
                  </div>
                ) : monthSeries ? (
                  <ProjectTrendChart
                    months={monthSeries}
                    isEstimatingSegment={signalsRow ? signalsRow.work_model === 'fixed_scope' || signalsRow.work_model === 'maintenance' : true}
                  />
                ) : (
                  <div className="px-4 py-6 text-sm text-neutral-400">Loading…</div>
                )}
              </Panel>
            </div>
          </section>

          <Accordion
            title="Tasks"
            meta={`${modeLoading ? '…' : shownTaskCount}${taskFilter !== 'all' ? ` of ${totalTaskCount}` : ''}${isAllTime ? '' : ' · touched in period'}`}
            open={tasksOpen}
            onToggle={() => setTasksOpen((v) => !v)}
          >
            {modeError ? (
              <div className="px-4 py-3 text-sm text-red-700">
                Tasks could not be loaded. <code className="text-xs">{modeError}</code>
              </div>
            ) : isAllTime ? (
              <DataTable
                data={filteredTasks}
                columns={allTimeColumns}
                loading={modeLoading}
                emptyText="No in-scope tasks (created since 2025-01-01) in this project."
                rowClassName={(t) =>
                  t.is_live_overrun
                    ? 'bg-red-50 border-t border-red-100 hover:bg-red-100'
                    : !t.is_estimated && !t.is_completed && t.actual_hours > 0
                      ? 'bg-amber-50 border-t border-amber-100 hover:bg-amber-100'
                      : 'border-t border-neutral-100 hover:bg-neutral-50'
                }
              />
            ) : (
              <DataTable
                data={filteredPeriodTasks}
                columns={periodColumns}
                loading={modeLoading}
                emptyText="No task was worked on in this period."
                rowClassName={(t) =>
                  t.is_live_overrun
                    ? 'bg-red-50 border-t border-red-100 hover:bg-red-100'
                    : !t.is_estimated && !t.is_completed && t.actual_hours > 0
                      ? 'bg-amber-50 border-t border-amber-100 hover:bg-amber-100'
                      : 'border-t border-neutral-100 hover:bg-neutral-50'
                }
              />
            )}
          </Accordion>

          <Accordion
            title="Contributors"
            meta={`${modeLoading || (isAllTime && contribRows == null) ? '…' : contributors.length}${isAllTime ? ' · all time' : ' · in period'}`}
            open={contributorsOpen}
            onToggle={() => setContributorsOpen((v) => !v)}
          >
            {(isAllTime && staticErrors.contributors) || modeError ? (
              <div className="px-4 py-3 text-sm text-red-700">
                Contributors could not be loaded.{' '}
                <code className="text-xs">{modeError ?? staticErrors.contributors}</code>
              </div>
            ) : modeLoading || (isAllTime && contribRows == null) ? (
              // The all-time stats join contributor rows with the task fetch;
              // rendering before both resolve would show confident zero
              // overrun/QA columns for named people (F5's lesson).
              <div className="py-6 text-center text-sm text-neutral-400">Loading…</div>
            ) : contributors.length === 0 ? (
              <div className="py-6 text-center text-sm text-neutral-400">
                {isAllTime ? 'No tracked time on in-scope tasks.' : 'No tracked time in this period.'}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">{isAllTime ? 'Hours' : 'Hours (period)'}</th>
                      <th className="px-4 py-2 font-medium">Tasks</th>
                      <th className="px-4 py-2 font-medium">Overrun tasks</th>
                      <th className="px-4 py-2 font-medium">Hours on overrun</th>
                      <th className="px-4 py-2 font-medium">Bugs Rate</th>
                      <th className="px-4 py-2 font-medium">Return Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributors.map((c) => (
                      <tr key={c.user_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                        <td className="px-4 py-2">
                          <Link
                            to="/people/$userId"
                            params={{ userId: String(c.user_id) }}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {c.display_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{formatHours(c.hours)}</td>
                        <td className="px-4 py-2">{c.tasks}</td>
                        <td className="px-4 py-2">
                          <span className={c.overrun_tasks > 0 ? 'font-medium text-red-600' : ''}>{c.overrun_tasks}</span>
                        </td>
                        <td className="px-4 py-2">{formatHours(c.hours_on_overrun)}</td>
                        <td className="px-4 py-2">
                          <QaRate kind="bugs" value={c.avg_qa_bugs} sampleSize={c.qa_bugs_tasks} />
                        </td>
                        <td className="px-4 py-2">
                          <QaRate kind="iterations" value={c.avg_qa_iterations} sampleSize={c.qa_iterations_tasks} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Accordion>

          <p className="text-[11px] leading-relaxed text-neutral-400">
            Scope: tasks created since 2025-01-01 on this project, per the §5 canonical views —
            legacy whole-history figures no longer render here. Overrun is gross (realized on
            completed tasks + live on open ones, container “bucket” tasks excluded from the live
            alarm and shown apart). “Hours on overrun” is this grain's own hours on tasks over
            their estimate — a contribution figure, not the §5 attribution used on the People page.
          </p>
        </>
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
