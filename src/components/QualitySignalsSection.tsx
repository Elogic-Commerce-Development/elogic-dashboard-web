import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { TaskActualVsEstimate } from '@/lib/queries'
import type { DashboardPeriodRange } from '@/lib/dashboardPeriod'

const ITERATIONS_BUCKETS = ['1', '2', '3', '4', '5+'] as const
const BUGS_BUCKETS = ['0', '1–2', '3–5', '6–10', '10+'] as const

type IterationsBucket = (typeof ITERATIONS_BUCKETS)[number]
type BugsBucket = (typeof BUGS_BUCKETS)[number]

const CAP_NOTE =
  'Values above the cap (5+ for iterations, 10+ for bugs) are stored as the cap. Distributions are exact; averages are not shown for this reason.'

function iterationsBucket(value: number, capped: boolean): IterationsBucket {
  if (capped || value >= 5) return '5+'
  if (value <= 1) return '1'
  if (value === 2) return '2'
  if (value === 3) return '3'
  return '4'
}

function bugsBucket(value: number, capped: boolean): BugsBucket {
  if (capped || value > 10) return '10+'
  if (value === 0) return '0'
  if (value <= 2) return '1–2'
  if (value <= 5) return '3–5'
  return '6–10'
}

function inPeriod(completedOn: string | null, range: DashboardPeriodRange): boolean {
  if (!completedOn) return false
  const day = completedOn.slice(0, 10)
  return day >= range.from && day <= range.to
}

type DistRow<B extends string> = { bucket: B; count: number }

function buildIterationsDist(qualifying: TaskActualVsEstimate[]): DistRow<IterationsBucket>[] {
  const counts = new Map<IterationsBucket, number>()
  for (const b of ITERATIONS_BUCKETS) counts.set(b, 0)
  for (const t of qualifying) {
    const b = iterationsBucket(Number(t.qa_iterations), t.qa_iterations_capped)
    counts.set(b, (counts.get(b) ?? 0) + 1)
  }
  return ITERATIONS_BUCKETS.map((b) => ({ bucket: b, count: counts.get(b) ?? 0 }))
}

function buildBugsDist(qualifying: TaskActualVsEstimate[]): DistRow<BugsBucket>[] {
  const counts = new Map<BugsBucket, number>()
  for (const b of BUGS_BUCKETS) counts.set(b, 0)
  for (const t of qualifying) {
    const b = bugsBucket(Number(t.qa_bugs), t.qa_bugs_capped)
    counts.set(b, (counts.get(b) ?? 0) + 1)
  }
  return BUGS_BUCKETS.map((b) => ({ bucket: b, count: counts.get(b) ?? 0 }))
}

export function QualitySignalsSection({
  tasks,
  range,
}: {
  tasks: TaskActualVsEstimate[]
  range: DashboardPeriodRange
}) {
  const [expanded, setExpanded] = useState(false)

  const iterationsQualifying = useMemo(
    () =>
      tasks.filter(
        (t) => t.is_completed && t.qa_iterations != null && inPeriod(t.completed_on, range),
      ),
    [tasks, range],
  )
  const bugsQualifying = useMemo(
    () =>
      tasks.filter(
        (t) => t.is_completed && t.qa_bugs != null && inPeriod(t.completed_on, range),
      ),
    [tasks, range],
  )

  const iterationsDist = useMemo(() => buildIterationsDist(iterationsQualifying), [iterationsQualifying])
  const bugsDist = useMemo(() => buildBugsDist(bugsQualifying), [bugsQualifying])

  const reopenCount = iterationsQualifying.filter(
    (t) => Number(t.qa_iterations) > 1 || t.qa_iterations_capped,
  ).length
  const bugCount = bugsQualifying.filter(
    (t) => Number(t.qa_bugs) > 0 || t.qa_bugs_capped,
  ).length

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50"
      >
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Quality signals (preview)</h3>
          <p className="text-xs text-neutral-500">
            Based on tasks that have QA Iterations and QA Bugs set. Coverage is currently low — treat
            these as directional.
          </p>
        </div>
        <span className="shrink-0 text-neutral-400" aria-hidden="true">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div className="grid gap-6 p-4 lg:grid-cols-2">
          <QualityCard
            title="QA Iterations (target: 1)"
            qualifyingCount={iterationsQualifying.length}
            emptyLabel="No tasks with QA Iterations in this period yet."
            chart={
              <DistributionChart<IterationsBucket>
                data={iterationsDist}
                isTarget={(b) => b === '1'}
              />
            }
            footer={
              iterationsQualifying.length > 0 && (
                <p className="mt-2 text-xs text-neutral-700">
                  <span className="font-semibold">Reopen rate:</span>{' '}
                  {formatPct(reopenCount, iterationsQualifying.length)} of tasks needed more than one
                  QA iteration ({reopenCount} of {iterationsQualifying.length} tasks)
                </p>
              )
            }
          />
          <QualityCard
            title="QA Bugs (target: 0)"
            qualifyingCount={bugsQualifying.length}
            emptyLabel="No tasks with QA Bugs in this period yet."
            chart={
              <DistributionChart<BugsBucket>
                data={bugsDist}
                isTarget={(b) => b === '0'}
              />
            }
            footer={
              bugsQualifying.length > 0 && (
                <p className="mt-2 text-xs text-neutral-700">
                  <span className="font-semibold">Bug ratio:</span>{' '}
                  {formatPct(bugCount, bugsQualifying.length)} of tasks had at least one QA bug (
                  {bugCount} of {bugsQualifying.length} tasks)
                </p>
              )
            }
          />
        </div>
      )}
    </div>
  )
}

function QualityCard({
  title,
  qualifyingCount,
  emptyLabel,
  chart,
  footer,
}: {
  title: string
  qualifyingCount: number
  emptyLabel: string
  chart: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <h4 className="text-sm font-medium text-neutral-900">{title}</h4>
        <span
          className="cursor-help select-none text-neutral-400"
          title={CAP_NOTE}
          aria-label={CAP_NOTE}
        >
          ⓘ
        </span>
      </div>
      {qualifyingCount === 0 ? (
        <div className="py-6 text-center text-xs text-neutral-400">{emptyLabel}</div>
      ) : (
        <>
          <div style={{ height: 180 }}>{chart}</div>
          {footer}
        </>
      )}
    </div>
  )
}

function DistributionChart<B extends string>({
  data,
  isTarget,
}: {
  data: DistRow<B>[]
  isTarget: (bucket: B) => boolean
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value) => [`${value} tasks`, 'Count']}
        />
        <Bar dataKey="count">
          {data.map((d) => (
            <Cell
              key={d.bucket}
              fill={isTarget(d.bucket) ? '#059669' : '#dc2626'}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function formatPct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((n / total) * 100)}%`
}
