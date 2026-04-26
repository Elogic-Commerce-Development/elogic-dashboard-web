import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { UnlinkedEmployeeBanner } from '@/components/UnlinkedEmployeeBanner'
import { UtilizationDonut } from '@/components/UtilizationDonut'
import { UtilizationSummaryCards } from '@/components/UtilizationSummaryCards'
import {
  fetchContributorTaskSummary,
  fetchEmployeeDays,
  fetchUserDetail,
  type ContributorTaskSummary,
  type EmployeeDay,
  type UserDetail,
} from '@/lib/queries'
import { formatHours, formatRatio, acTaskUrl } from '@/lib/format'
import { periodRange, type PeriodPreset } from '@/lib/period'
import { summarizeUtilization } from '@/lib/utilization'

const taskColumns: ColumnDef<ContributorTaskSummary>[] = [
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
    header: 'Task actual',
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
    id: 'ratio',
    header: 'Ratio',
    cell: ({ row }) => {
      const est = row.original.estimate_hours
      const actual = Number(row.original.task_actual_hours)
      if (est == null || est === 0) return '—'
      const r = actual / est
      const cls = r >= 2 ? 'text-red-600 font-medium' : r >= 1.5 ? 'text-amber-600' : ''
      return <span className={cls}>{formatRatio(r)}</span>
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

  const activePreset: PeriodPreset = search.preset ?? 'current_month'
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
    setLoadingUser(true)
    fetchUserDetail(uid)
      .then((data) => { if (!cancelled) setUser(data) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setLoadingUser(false) })
    return () => { cancelled = true }
  }, [uid])

  // v_employee_day rows for the selected period
  useEffect(() => {
    let cancelled = false
    setLoadingDays(true)
    fetchEmployeeDays(uid, range.from, range.to)
      .then((data) => { if (!cancelled) setDays(data) })
      .catch(() => { if (!cancelled) setDays([]) })
      .finally(() => { if (!cancelled) setLoadingDays(false) })
    return () => { cancelled = true }
  }, [uid, range.from, range.to])

  // Task table for the selected period
  useEffect(() => {
    let cancelled = false
    setLoadingTasks(true)
    fetchContributorTaskSummary(uid, { from: range.from, to: range.to })
      .then((data) => { if (!cancelled) setTasks(data) })
      .catch(() => { if (!cancelled) setTasks([]) })
      .finally(() => { if (!cancelled) setLoadingTasks(false) })
    return () => { cancelled = true }
  }, [uid, range.from, range.to])

  const summary = useMemo(() => summarizeUtilization(days, range.from, range.to), [days, range.from, range.to])
  const isLinked = (user?.peopleforce_id ?? null) !== null
  const name = user?.display_name ?? tasks[0]?.contributor_name ?? `User #${uid}`

  function setPeriod(preset: PeriodPreset, customFrom?: string, customTo?: string) {
    navigate({
      to: '/people/$userId',
      params: { userId: String(uid) },
      search: () => ({
        preset,
        from: preset === 'custom' ? customFrom : undefined,
        to: preset === 'custom' ? customTo : undefined,
      }),
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
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-700">
            PF #{user.peopleforce_id}
          </span>
        )}
      </div>

      <PeriodSwitcher
        preset={activePreset}
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
