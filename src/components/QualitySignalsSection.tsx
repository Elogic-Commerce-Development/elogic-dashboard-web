import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  type TooltipContentProps,
} from 'recharts'
import type { DashboardQualityMonth } from '@/lib/queries'
import { enumerateMonths, type DashboardPeriodRange } from '@/lib/dashboardPeriod'

const CAP_NOTE =
  'Values above the cap (5+ for iterations, 10+ for bugs) are stored as the cap. A median shown with a "≥" prefix is a lower bound — at least one task in that month hit the cap, so the true median may be higher.'

type MonthBucket = {
  month: string
  label: string
  median: number | null
  p25: number | null
  p75: number | null
  sample_size: number
  any_capped: boolean
  bar_value: number
}

function formatMonthLabel(monthIso: string): string {
  const d = new Date(monthIso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function buildBuckets(
  data: DashboardQualityMonth[],
  range: DashboardPeriodRange,
  pick: (d: DashboardQualityMonth) => {
    median: number | null
    p25: number | null
    p75: number | null
    sample_size: number
    any_capped: boolean
  },
): MonthBucket[] {
  const byMonth = new Map(data.map((d) => [d.month, d]))

  const withMedians = enumerateMonths(range).map((m) => {
    const row = byMonth.get(m)
    const v = row
      ? pick(row)
      : { median: null, p25: null, p75: null, sample_size: 0, any_capped: false }
    return {
      month: m,
      label: formatMonthLabel(m),
      median: v.median != null ? Number(v.median) : null,
      p25: v.p25 != null ? Number(v.p25) : null,
      p75: v.p75 != null ? Number(v.p75) : null,
      sample_size: Number(v.sample_size),
      any_capped: v.any_capped,
    }
  })

  const maxReal = withMedians.reduce(
    (m, b) => (b.median != null && b.median > m ? b.median : m),
    1,
  )
  const placeholder = maxReal * 0.05

  return withMedians.map((b) => ({
    ...b,
    bar_value: b.median ?? placeholder,
  }))
}

function formatMedian(b: MonthBucket): string {
  if (b.median == null) return '—'
  const rounded = Number.isInteger(b.median) ? b.median.toString() : b.median.toFixed(1)
  return b.any_capped ? `≥ ${rounded}` : rounded
}

function formatRange(b: MonthBucket): string {
  if (b.p25 == null || b.p75 == null) return '—'
  const lo = Number.isInteger(b.p25) ? b.p25.toString() : b.p25.toFixed(1)
  const hi = Number.isInteger(b.p75) ? b.p75.toString() : b.p75.toFixed(1)
  return `${lo} – ${hi}`
}

function QaTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as MonthBucket
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-neutral-900">{row.label}</div>
      {row.sample_size === 0 ? (
        <div className="mt-1 text-neutral-500">No qualifying tasks this month.</div>
      ) : (
        <div className="mt-1 space-y-0.5 text-neutral-700">
          <div>
            <span className="text-neutral-500">Median:</span>{' '}
            <span className="font-medium">{formatMedian(row)}</span>
          </div>
          <div>
            <span className="text-neutral-500">p25–p75:</span>{' '}
            <span className="font-medium">{formatRange(row)}</span>
          </div>
          <div>
            <span className="text-neutral-500">Sample size:</span>{' '}
            <span className="font-medium">{row.sample_size}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function QaCard({
  title,
  buckets,
  target,
  goodAtOrBelow,
  warnAtOrBelow,
  yMax,
}: {
  title: string
  buckets: MonthBucket[]
  target: number
  goodAtOrBelow: number
  warnAtOrBelow: number
  yMax: number
}) {
  const totalSamples = buckets.reduce((s, b) => s + b.sample_size, 0)

  function barColor(m: number | null): string {
    if (m == null) return '#a3a3a3'
    if (m <= goodAtOrBelow) return '#059669'  // emerald-600
    if (m <= warnAtOrBelow) return '#d97706'   // amber-600
    return '#dc2626'                            // red-600
  }

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
        <span className="ml-auto text-xs text-neutral-500">
          {totalSamples} task{totalSamples === 1 ? '' : 's'}
        </span>
      </div>
      {totalSamples === 0 ? (
        <div className="py-10 text-center text-xs text-neutral-400">
          No qualifying tasks in this period yet.
        </div>
      ) : (
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                domain={[0, yMax]}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
              />
              <ReferenceLine
                yAxisId="left"
                y={target}
                stroke="#737373"
                strokeDasharray="4 4"
                label={{
                  value: `Target: ${target}`,
                  position: 'right',
                  fontSize: 10,
                  fill: '#737373',
                }}
              />
              <Tooltip content={(props) => <QaTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
              <Bar yAxisId="left" dataKey="bar_value" name="Median">
                {buckets.map((b) => (
                  <Cell
                    key={b.month}
                    fill={b.sample_size === 0 ? '#a3a3a3' : barColor(b.median)}
                    fillOpacity={b.sample_size === 0 ? 0.25 : 0.75}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sample_size"
                name="Sample size"
                stroke="#737373"
                strokeWidth={1.5}
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function QualitySignalsSection({
  data,
  range,
}: {
  data: DashboardQualityMonth[]
  range: DashboardPeriodRange
}) {
  const [expanded, setExpanded] = useState(false)

  const iterations = useMemo(
    () =>
      buildBuckets(data, range, (d) => ({
        median: d.iter_median,
        p25: d.iter_p25,
        p75: d.iter_p75,
        sample_size: d.iter_sample_size,
        any_capped: d.iter_any_capped,
      })),
    [data, range],
  )

  const bugs = useMemo(
    () =>
      buildBuckets(data, range, (d) => ({
        median: d.bug_median,
        p25: d.bug_p25,
        p75: d.bug_p75,
        sample_size: d.bug_sample_size,
        any_capped: d.bug_any_capped,
      })),
    [data, range],
  )

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
            Median QA iterations and QA bugs over time, bucketed by task completion month.
            Coverage is currently low — treat these as directional.
          </p>
        </div>
        <span className="shrink-0 text-neutral-400" aria-hidden="true">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div className="grid gap-6 p-4 lg:grid-cols-2">
          <QaCard
            title="QA Iterations (target: 1)"
            buckets={iterations}
            target={1}
            goodAtOrBelow={1}
            warnAtOrBelow={2}
            yMax={5}
          />
          <QaCard
            title="QA Bugs (target: 0)"
            buckets={bugs}
            target={0}
            goodAtOrBelow={0}
            warnAtOrBelow={2}
            yMax={10}
          />
        </div>
      )}
    </div>
  )
}
