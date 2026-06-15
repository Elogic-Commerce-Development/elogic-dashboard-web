import { useMemo } from 'react'
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
  Legend,
  ReferenceLine,
  type TooltipContentProps,
} from 'recharts'
import type { DashboardAccuracyMonth } from '@/lib/queries'
import { enumerateMonths, type DashboardPeriodRange } from '@/lib/dashboardPeriod'

type Bucket = {
  month: string                            // "YYYY-MM-01"
  label: string                            // "Apr 26"
  /** Mean of (actual_hours / estimate_hours) across qualifying tasks. */
  mean_usage: number | null
  min_usage: number | null
  max_usage: number | null
  sample_size: number
  /**
   * Bar height to render. For months with data this equals mean_usage.
   * For empty months it's a small fraction of the largest real usage so a
   * faint placeholder bar is visible (Recharts skips bars with null values,
   * which makes empty periods look like the chart is broken).
   */
  bar_value: number
}

function formatMonthLabel(monthIso: string): string {
  const d = new Date(monthIso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function buildBuckets(data: DashboardAccuracyMonth[], range: DashboardPeriodRange): Bucket[] {
  const byMonth = new Map(data.map((d) => [d.month, d]))

  const withStats = enumerateMonths(range).map((m) => {
    const row = byMonth.get(m)
    return {
      month: m,
      label: formatMonthLabel(m),
      mean_usage: row && row.mean_usage != null ? Number(row.mean_usage) : null,
      min_usage: row && row.min_usage != null ? Number(row.min_usage) : null,
      max_usage: row && row.max_usage != null ? Number(row.max_usage) : null,
      sample_size: row ? Number(row.sample_size) : 0,
    }
  })

  const maxReal = withStats.reduce(
    (m, b) => (b.mean_usage != null && b.mean_usage > m ? b.mean_usage : m),
    1,
  )
  const placeholder = maxReal * 0.05

  return withStats.map((b) => ({
    ...b,
    bar_value: b.mean_usage ?? placeholder,
  }))
}

function barColor(usage: number | null): string {
  if (usage == null) return '#e5e5e5'
  if (usage >= 2) return '#dc2626'      // red-600
  if (usage >= 1.5) return '#d97706'    // amber-600
  return '#059669'                       // emerald-600
}

function AccuracyTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as Bucket
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-neutral-900">{row.label}</div>
      {row.sample_size === 0 ? (
        <div className="mt-1 text-neutral-500">No qualifying tasks this month.</div>
      ) : (
        <div className="mt-1 space-y-0.5 text-neutral-700">
          <div>
            <span className="text-neutral-500">Avg usage:</span>{' '}
            <span className="font-medium">{formatPct(row.mean_usage)}</span>
          </div>
          <div>
            <span className="text-neutral-500">Min–max:</span>{' '}
            <span className="font-medium">{formatPct(row.min_usage)} – {formatPct(row.max_usage)}</span>
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

function formatPct(r: number | null | undefined): string {
  if (r == null) return '—'
  return `${Math.round(r * 100)}%`
}

export function EstimateAccuracyChart({
  data,
  range,
}: {
  data: DashboardAccuracyMonth[]
  range: DashboardPeriodRange
}) {
  const chartData = useMemo(() => buildBuckets(data, range), [data, range])
  const hasAny = chartData.some((d) => d.sample_size > 0)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">Estimate accuracy over time</h3>
        <p className="text-xs text-neutral-500">
          Average usage of the estimate (logged hours ÷ estimated hours) for tasks completed each
          month. 100% = on estimate. Sample size shown on the right axis.
        </p>
      </div>
      <div className="px-2 py-4" style={{ height: 300 }}>
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
              />
              <ReferenceLine
                yAxisId="left"
                y={1}
                stroke="#737373"
                strokeDasharray="4 4"
                label={{ value: 'On estimate', position: 'right', fontSize: 10, fill: '#737373' }}
              />
              <Tooltip content={(props) => <AccuracyTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="bar_value" name="Avg usage">
                {chartData.map((d) => (
                  <Cell
                    key={d.month}
                    fill={d.sample_size === 0 ? '#a3a3a3' : barColor(d.mean_usage)}
                    fillOpacity={d.sample_size === 0 ? 0.25 : 0.75}
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
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            No qualifying tasks in this period yet.
          </div>
        )}
      </div>
    </div>
  )
}
