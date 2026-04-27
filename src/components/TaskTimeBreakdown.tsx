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
 * AC billable_status enum:
 *   1 / 2 / 3 → billable (billable / already billed / pending payment)
 *   0         → not billable
 *   null / anything else → "other" — surfaced as its own headline tile only
 *                          when entries actually have it (expected to be 0)
 */
type BillBucket = 'billable' | 'not_billable' | 'other'
function billBucket(status: number | null): BillBucket {
  if (status === 0) return 'not_billable'
  if (status === 1 || status === 2 || status === 3) return 'billable'
  return 'other'
}

export function TaskTimeBreakdown({ estimate, actual, entries, employeeColors }: Props) {
  const total = actual

  const empColorMap = useMemo(
    () => employeeColors ?? buildEmployeeColorMap(entries.map((e) => ({ user_id: e.user_id, hours: e.hours }))),
    [employeeColors, entries],
  )

  const { byJobType, byEmployee, billableHours, notBillableHours, otherHours } = useMemo(() => {
    const jt = new Map<string, Slice>()
    const emp = new Map<number, Slice>()
    let billable = 0
    let notBillable = 0
    let other = 0

    for (const e of entries) {
      switch (billBucket(e.billable_status)) {
        case 'billable':     billable += e.hours; break
        case 'not_billable': notBillable += e.hours; break
        case 'other':        other += e.hours; break
      }

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
      otherHours: other,
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

  // Headline tiles. The first three describe the budget; the next two
  // describe billable status. "Other" only appears when entries actually
  // have an unrecognised billable_status (expected to be zero in practice).
  type Tile = { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }
  const tiles: Tile[] = [
    { label: 'Spent', value: formatHours(actual) },
    { label: 'Estimated', value: estimate != null ? formatHours(estimate) : '—' },
    { label: headlineRight.label, value: headlineRight.value, tone: headlineRight.tone },
  ]
  if (total > 0) {
    tiles.push({ label: 'Billable', value: formatHours(billableHours), tone: 'good' })
    tiles.push({ label: 'Not billable', value: formatHours(notBillableHours) })
    if (otherHours > 0) {
      tiles.push({ label: 'Other', value: formatHours(otherHours), tone: 'bad' })
    }
  }
  // grid-cols class chosen so all tiles fit on one row at lg+. With Other we
  // need 6 columns; without Other, 5; without billable info at all (no time
  // logged yet), 3.
  const lgCols =
    tiles.length === 6 ? 'lg:grid-cols-6' : tiles.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-3'

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      {/* Headline strip — Spent / Estimated / (Remaining or Over plan) /
          Billable / Not billable / [Other]. The gap-px+bg-neutral-200
          trick draws 1px dividers between tiles that survive grid wrapping. */}
      <div className={`grid grid-cols-2 gap-px border-b border-neutral-200 bg-neutral-200 sm:grid-cols-3 ${lgCols}`}>
        {tiles.map((t) => (
          <HeadlineStat key={t.label} label={t.label} value={t.value} tone={t.tone} />
        ))}
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
    <div className="bg-white px-4 py-3">
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
