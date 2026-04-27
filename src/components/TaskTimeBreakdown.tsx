import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { jobTypeColor, NO_JOB_TYPE_LABEL } from '@/lib/jobTypes'
import { buildEmployeeColorMap } from '@/lib/contributorColors'
import type { TaskTimeEntry } from '@/lib/queries'
import { formatHours } from '@/lib/format'

type Props = {
  estimate: number | null
  actual: number
  entries: TaskTimeEntry[]
  /** Optional override; if not provided we compute the default per-task map. */
  employeeColors?: Map<number, string>
}

type Slice = {
  id: string
  label: string
  hours: number
  color: string
  href?: { pathname: '/people/$userId'; userId: string }
}

/**
 * Bill status counts as "billable" if the AC enum is 1 (billable),
 * 2 (already billed), or 3 (pending payment). 0 and null are not billable.
 */
function isBillable(status: number | null): boolean {
  return status != null && status !== 0
}

export function TaskTimeBreakdown({ estimate, actual, entries, employeeColors }: Props) {
  const total = actual

  const empColorMap = useMemo(
    () => employeeColors ?? buildEmployeeColorMap(entries.map((e) => ({ user_id: e.user_id, hours: e.hours }))),
    [employeeColors, entries],
  )

  const { byJobType, byEmployee, billableHours, notBillableHours } = useMemo(() => {
    const jt = new Map<string, Slice>()
    const emp = new Map<number, Slice>()
    let billable = 0
    let notBillable = 0

    for (const e of entries) {
      if (isBillable(e.billable_status)) billable += e.hours
      else notBillable += e.hours

      // Job-type bucket
      const jtKey = e.job_type_name ?? '__none__'
      const jtLabel = e.job_type_name ?? NO_JOB_TYPE_LABEL
      const jtExisting = jt.get(jtKey)
      if (jtExisting) {
        jtExisting.hours += e.hours
      } else {
        jt.set(jtKey, {
          id: jtKey,
          label: jtLabel,
          hours: e.hours,
          color: jobTypeColor(e.job_type_name),
        })
      }

      // Employee bucket
      const empExisting = emp.get(e.user_id)
      if (empExisting) {
        empExisting.hours += e.hours
      } else {
        emp.set(e.user_id, {
          id: String(e.user_id),
          label: e.user_name,
          hours: e.hours,
          color: empColorMap.get(e.user_id) ?? '#475569',
          href: { pathname: '/people/$userId', userId: String(e.user_id) },
        })
      }
    }

    return {
      byJobType: Array.from(jt.values()).sort((a, b) => b.hours - a.hours),
      byEmployee: Array.from(emp.values()).sort((a, b) => b.hours - a.hours),
      billableHours: billable,
      notBillableHours: notBillable,
    }
  }, [entries, empColorMap])

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
      {/* Billable summary strip */}
      {total > 0 && (
        <BillableStrip
          billable={billableHours}
          notBillable={notBillableHours}
          entryCount={entries.length}
        />
      )}

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

function BillableStrip({
  billable,
  notBillable,
  entryCount,
}: {
  billable: number
  notBillable: number
  entryCount: number
}) {
  const total = billable + notBillable
  const billablePct = total > 0 ? (billable / total) * 100 : 0
  return (
    <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
            <span className="text-neutral-600">Billable</span>
            <span className="font-semibold tabular-nums text-neutral-900">{formatHours(billable)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-neutral-400" />
            <span className="text-neutral-600">Not billable</span>
            <span className="font-semibold tabular-nums text-neutral-900">{formatHours(notBillable)}</span>
          </span>
        </div>
        <span className="text-neutral-400 tabular-nums">
          {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      {/* Inline mini-bar showing billable share */}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${billablePct}%` }}
          title={`${Math.round(billablePct)}% billable`}
        />
      </div>
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
              const widthPct = barTotal > 0
                ? (s.hours / barTotal) * (100 / Math.max(filledPct, 0.0001)) * 100
                : 0
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

          {/* Overrun stripe overlay */}
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
