import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { PersonQualityCards } from '@/components/PersonQualityCards'
import { UnlinkedEmployeeBanner } from '@/components/UnlinkedEmployeeBanner'
import { UtilizationDonut } from '@/components/UtilizationDonut'
import { UtilizationSummaryCards } from '@/components/UtilizationSummaryCards'
import { PersonCalibrationDetail } from '@/components/people/PersonCalibrationDetail'
import { PersonOpenWork } from '@/components/people/PersonOpenWork'
import { TrackingDeficits } from '@/components/people/TrackingDeficits'
import { LoadFailure } from '@/components/estimation/Section'
import { describeError } from '@/lib/errors'
import {
  fetchCalibrationByPerson,
  fetchContributorTaskSummary,
  fetchEmployeeDays,
  fetchMetricConfig,
  fetchPersonCalibrationSample,
  fetchPersonOpenWork,
  fetchTrackingDeficits,
  fetchUserDetail,
  type ContributorTaskSummary,
  type EmployeeDay,
  type PersonCalibration,
  type PersonCalibrationTask,
  type PersonOpenTask,
  type TrackingDeficit,
  type UserDetail,
} from '@/lib/queries'
import { formatHours, formatRatio, externalTaskLink, peopleForceEmployeeUrl } from '@/lib/format'
import { SourceBadge } from '@/components/SourceBadge'
import { PERIOD_GROUPS, periodRange, periodSearchParams, type PeriodPreset } from '@/lib/period'
import { summarizeUtilization } from '@/lib/utilization'

const taskColumns: ColumnDef<ContributorTaskSummary>[] = [
  {
    accessorKey: 'task_name',
    header: 'Task',
    cell: ({ row }) => {
      const ext = externalTaskLink({
        source: row.original.source,
        projectId: row.original.project_id,
        taskId: row.original.task_id,
        taskJiraKey: row.original.task_jira_key,
      })
      return (
        <div className="flex items-center gap-1.5">
          <Link
            to="/tasks/$taskId"
            params={{ taskId: String(row.original.task_id) }}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.task_name}
          </Link>
          <SourceBadge source={row.original.source} />
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
    },
  },
  {
    accessorKey: 'project_name',
    header: 'Project',
    cell: ({ row }) => (
      <Link
        to="/projects/$projectId"
        params={{ projectId: String(row.original.project_id) }}
        className="text-neutral-700 hover:text-blue-600 hover:underline"
      >
        {row.original.project_name}
      </Link>
    ),
  },
  {
    accessorKey: 'estimate_hours',
    header: 'Estimate',
    cell: ({ getValue }) => formatHours(getValue() as number | null),
  },
  {
    accessorKey: 'task_actual_hours',
    header: 'Total Tracked',
    cell: ({ getValue }) => formatHours(Number(getValue())),
  },
  {
    accessorKey: 'contributor_hours',
    header: 'My hours',
    cell: ({ getValue }) => formatHours(Number(getValue())),
  },
  {
    id: 'share',
    header: 'Share',
    cell: ({ row }) => {
      const actual = Number(row.original.task_actual_hours)
      if (actual === 0) return '—'
      return formatRatio(Number(row.original.contributor_hours) / actual)
    },
  },
  {
    accessorKey: 'is_completed',
    header: 'Status',
    cell: ({ getValue }) => (getValue() ? 'Completed' : 'Open'),
  },
]

export function ContributorDetailPage() {
  const { userId } = useParams({ from: '/people/$userId' })
  const search = useSearch({ from: '/people/$userId' })
  const navigate = useNavigate()
  const uid = Number(userId)

  const activePreset: PeriodPreset = search.period ?? PERIOD_GROUPS.person.default
  const range = useMemo(
    () => periodRange(activePreset, search.from, search.to),
    [activePreset, search.from, search.to],
  )

  const [user, setUser] = useState<UserDetail | null>(null)
  const [days, setDays] = useState<EmployeeDay[]>([])
  const [tasks, setTasks] = useState<ContributorTaskSummary[]>([])
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingDays, setLoadingDays] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)

  // User detail (independent of period)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingUser(true)
      try {
        const data = await fetchUserDetail(uid)
        if (!cancelled) setUser(data)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoadingUser(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [uid])

  // v_employee_day rows for the selected period
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingDays(true)
      try {
        const data = await fetchEmployeeDays(uid, range.from, range.to)
        if (!cancelled) setDays(data)
      } catch {
        if (!cancelled) setDays([])
      } finally {
        if (!cancelled) setLoadingDays(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [uid, range.from, range.to])

  // Task table for the selected period
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingTasks(true)
      try {
        const data = await fetchContributorTaskSummary(uid, { from: range.from, to: range.to })
        if (!cancelled) setTasks(data)
      } catch {
        if (!cancelled) setTasks([])
      } finally {
        if (!cancelled) setLoadingTasks(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [uid, range.from, range.to])

  // ── §4.5 coaching sections ────────────────────────────────────────────────
  // Period-independent on purpose: calibration is the all-time §5 sample
  // (§1.3 — quarterly at best, never monthly), and "open work" is a statement
  // about right now. Only the utilization donut and the task table below
  // follow the period switcher, which is why these load in their own effect.
  const [coaching, setCoaching] = useState<{
    calibration: PersonCalibration[]
    sample: PersonCalibrationTask[]
    openWork: PersonOpenTask[]
    deficits: TrackingDeficit[]
    floor: number
  }>({ calibration: [], sample: [], openWork: [], deficits: [], floor: 10 })
  const [coachingError, setCoachingError] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setCoachingError(undefined)
      try {
        const [calibration, sample, openWork, deficits, config] = await Promise.all([
          fetchCalibrationByPerson(),
          fetchPersonCalibrationSample(uid),
          fetchPersonOpenWork(uid),
          fetchTrackingDeficits(uid),
          fetchMetricConfig(),
        ])
        if (!cancelled) {
          setCoaching({
            calibration,
            sample,
            openWork,
            deficits,
            floor: config.person_min_sample,
          })
        }
      } catch (e) {
        if (!cancelled) setCoachingError(describeError(e))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [uid])

  const myCalibration = useMemo(
    () => coaching.calibration.find((c) => c.user_id === uid),
    [coaching.calibration, uid],
  )

  const summary = useMemo(() => summarizeUtilization(days, range.from, range.to), [days, range.from, range.to])
  const isLinked = (user?.peopleforce_id ?? null) !== null
  const name = user?.display_name ?? tasks[0]?.contributor_name ?? `User #${uid}`

  function setPeriod(preset: PeriodPreset, customFrom?: string, customTo?: string) {
    navigate({
      to: '/people/$userId',
      params: { userId: String(uid) },
      search: () => periodSearchParams(preset, PERIOD_GROUPS.person, customFrom, customTo),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{loadingUser ? 'Loading…' : name}</h2>
        {user?.class && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-600">
            {user.class}
          </span>
        )}
        {user?.peopleforce_id != null && (
          <a
            href={peopleForceEmployeeUrl(user.peopleforce_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-700 hover:bg-blue-100 hover:underline"
            title="Open profile in PeopleForce"
          >
            PF #{user.peopleforce_id} ↗
          </a>
        )}
      </div>

      <PeriodSwitcher
        preset={activePreset}
        group={PERIOD_GROUPS.person}
        customFrom={search.from}
        customTo={search.to}
        onChange={setPeriod}
      />

      {!loadingUser && !isLinked ? (
        <UnlinkedEmployeeBanner displayName={user?.display_name} userClass={user?.class} />
      ) : (
        <>
          <UtilizationDonut summary={summary} />
          <UtilizationSummaryCards summary={summary} />
          {loadingDays && (
            <div className="text-xs text-neutral-400">Refreshing utilization…</div>
          )}
        </>
      )}

      {/* §4.5's coaching card, expanded. Above the period-scoped sections
          because it is what a 1:1 is actually prepared from. */}
      {coachingError ? (
        <LoadFailure what="The coaching sections" error={coachingError} />
      ) : (
        <>
          <PersonCalibrationDetail
            calibration={myCalibration}
            allCalibration={coaching.calibration}
            sample={coaching.sample}
            userId={uid}
            floor={coaching.floor}
          />
          <PersonOpenWork tasks={coaching.openWork} />
          <TrackingDeficits rows={coaching.deficits} />
        </>
      )}

      <PersonQualityCards tasks={tasks} />

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">
          Tasks contributed to (in period)
        </h3>
        <DataTable
          data={tasks}
          columns={taskColumns}
          loading={loadingTasks}
          emptyText="No tasks logged in this period."
        />
      </section>
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
