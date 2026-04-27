import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { jobTypeColor, NO_JOB_TYPE_LABEL } from '@/lib/jobTypes'
import type { TaskTimeRecord } from '@/lib/queries'
import { formatHours } from '@/lib/format'

type Props = {
  estimate: number | null
  actual: number
  records: TaskTimeRecord[]
}

type Slice = {
  id: string
  label: string
  hours: number
  color: string
  /** Optional secondary line under the slice (e.g. "16h • 80%") */
  href?: { pathname: '/people/$userId'; userId: string }
}

/**
 * Sequential slate shades for the employee bar — chosen so the second
 * visualisation reads as "the same hours, sliced differently" rather than
 * competing with the categorical job-type colours above it.
 */
const EMPLOYEE_SHADES = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

export function TaskTimeBreakdown({ estimate, actual, records }: Props) {
  const total = actual

  const { byJobType, byEmployee } = useMemo(() => {
    const jt = new Map<string, Slice>()
    const emp = new Map<number, Slice & { hours: number }>()

    for (const r of records) {
      const jtKey = r.job_type_name ?? '__none__'
      const jtLabel = r.job_type_name ?? NO_JOB_TYPE_LABEL
      const jtExisting = jt.get(jtKey)
      if (jtExisting) {
        jtExisting.hours += r.hours
      } else {
        jt.set(jtKey, {
          id: jtKey,
          label: jtLabel,
          hours: r.hours,
          color: jobTypeColor(r.job_type_name),
        })
      }

      const empExisting = emp.get(r.user_id)
      if (empExisting) {
        empExisting.hours += r.hours
      } else {
        emp.set(r.user_id, {
          id: String(r.user_id),
          label: r.user_name,
          hours: r.hours,
          color: '#475569', // assigned below in order
          href: { pathname: '/people/$userId', userId: String(r.user_id) },
        })
      }
    }

    const jobSlices = Array.from(jt.values()).sort((a, b) => b.hours - a.hours)
    const empSlices = Array.from(emp.values())
      .sort((a, b) => b.hours - a.hours)
      .map((s, i) => ({ ...s, color: EMPLOYEE_SHADES[i % EMPLOYEE_SHADES.length] }))

    return { byJobType: jobSlices, byEmployee: empSlices }
  }, [records])

  // Bar geometry. Track width = max(actual, estimate). The filled portion is
  // `actual`; if there's slack between actual and estimate, it shows as a
  // neutral "remaining" zone. If actual > estimate, the portion past the
  // estimate marker is the overrun zone (rendered with a stripe overlay).
  const barTotal = Math.max(actual, estimate ?? 0)
  const estimateMarkerPct = barTotal > 0 && estimate != null ? (estimate / barTotal) * 100 : null
  const filledPct = barTotal > 0 ? (actual / barTotal) * 100 : 0
  const isOverrun = estimate != null && actual > estimate
  const remaining = estimate != null ? estimate - actual : null

  const headlineRight: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' } =
    estimate == null
      ? { label: 'No estimate', value: '—', tone: 'neutral' }
      : isOverrun
        ? { label: 'Over plan', value: `+${formatHours(actual - estimate)}`, tone: 'bad' }
        : { label: 'Remaining', value: formatHours(remaining ?? 0), tone: 'good' }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      {/* Headline numbers */}
      <div className="grid grid-cols-3 divide-x divide-neutral-200 border-b border-neutral-200">
        <HeadlineStat label="Spent" value={formatHours(actual)} />
        <HeadlineStat label="Estimated" value={estimate != null ? formatHours(estimate) : '—'} />
        <HeadlineStat
          label={headlineRight.label}
          value={headlineRight.value}
          tone={headlineRight.tone}
        />
      </div>

      {total === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-neutral-400">
          No time logged on this task yet.
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <Bar
            label="By job type"
            slices={byJobType}
            barTotal={barTotal}
            filledPct={filledPct}
            estimateMarkerPct={estimateMarkerPct}
            isOverrun={isOverrun}
          />
          <Bar
            label="By employee"
            slices={byEmployee}
            barTotal={barTotal}
            filledPct={filledPct}
            estimateMarkerPct={estimateMarkerPct}
            isOverrun={isOverrun}
          />

          {/* Legends */}
          <div className="grid gap-x-6 gap-y-3 pt-2 sm:grid-cols-2">
            <Legend title="Job type" slices={byJobType} total={total} />
            <Legend title="Employee" slices={byEmployee} total={total} />
          </div>
        </div>
      )}
    </div>
  )
}

function HeadlineStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
  const valueClass =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'bad'
        ? 'text-red-600'
        : 'text-neutral-900'
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

function Bar({
  label,
  slices,
  barTotal,
  filledPct,
  estimateMarkerPct,
  isOverrun,
}: {
  label: string
  slices: Slice[]
  barTotal: number
  filledPct: number
  estimateMarkerPct: number | null
  isOverrun: boolean
}) {
  // Each slice's width as a fraction of the FILLED portion (actual hours).
  // The filled portion itself is `filledPct` of the bar track width.
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs text-neutral-500">
        <span className="font-medium text-neutral-700">{label}</span>
        <span className="tabular-nums">{slices.length} {slices.length === 1 ? 'segment' : 'segments'}</span>
      </div>
      <div className="relative">
        {/* Track */}
        <div className="relative h-7 overflow-hidden rounded bg-neutral-100">
          {/* Filled portion: stacked segments */}
          <div
            className="relative flex h-full"
            style={{ width: `${filledPct}%` }}
          >
            {slices.map((s) => {
              const widthPct = barTotal > 0 ? (s.hours / barTotal) * (100 / Math.max(filledPct, 0.0001)) * 100 : 0
              // The above expression normalises so each slice's width is its
              // share of the FILLED portion (which itself is filledPct of the track).
              return (
                <div
                  key={s.id}
                  className="group relative h-full transition-[filter] hover:[filter:brightness(1.05)]"
                  style={{ width: `${widthPct}%`, backgroundColor: s.color }}
                  title={`${s.label}: ${formatHours(s.hours)}`}
                />
              )
            })}
          </div>

          {/* Overrun stripe overlay — covers the portion of the filled bar
              that lies past the estimate marker. Only shown when actual > estimate. */}
          {isOverrun && estimateMarkerPct !== null && (
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{
                left: `${estimateMarkerPct}%`,
                width: `${filledPct - estimateMarkerPct}%`,
                backgroundImage:
                  'repeating-linear-gradient(135deg, rgba(220,38,38,0.45) 0 4px, transparent 4px 8px)',
              }}
              title="Overrun zone"
            />
          )}
        </div>

        {/* Estimate marker line */}
        {estimateMarkerPct !== null && (
          <div
            className="pointer-events-none absolute -top-1 -bottom-1 z-10 w-px bg-neutral-900"
            style={{ left: `${estimateMarkerPct}%` }}
            title="Estimate"
          >
            <div className="absolute -translate-x-1/2 rounded-sm bg-neutral-900 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white" style={{ top: '-14px' }}>
              EST
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Legend({ title, slices, total }: { title: string; slices: Slice[]; total: number }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-neutral-500">{title}</div>
      <ul className="space-y-1 text-xs">
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.hours / total) * 100) : 0
          return (
            <li key={s.id} className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 translate-y-0.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.href ? (
                  <Link
                    to={s.href.pathname}
                    params={{ userId: s.href.userId }}
                    className="truncate text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {s.label}
                  </Link>
                ) : (
                  <span className="truncate text-neutral-700">{s.label}</span>
                )}
              </span>
              <span className="shrink-0 text-neutral-500 tabular-nums">
                {formatHours(s.hours)} <span className="text-neutral-400">· {pct}%</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
