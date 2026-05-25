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
import type { TaskActualVsEstimate } from '@/lib/queries'
import { median, percentile } from '@/lib/stats'
import { enumerateMonths, type DashboardPeriodRange } from '@/lib/dashboardPeriod'

type Bucket = {
  month: string                            // "YYYY-MM-01"
  label: string                            // "Apr 26"
  median_overrun_ratio: number | null
  p25: number | null
  p75: number | null
  sample_size: number
}

function formatMonthLabel(monthIso: string): string {
  const d = new Date(monthIso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function buildBuckets(tasks: TaskActualVsEstimate[], range: DashboardPeriodRange): Bucket[] {
  const months = enumerateMonths(range)
  const ratiosByMonth = new Map<string, number[]>()
  for (const m of months) ratiosByMonth.set(m, [])

  for (const t of tasks) {
    if (!t.is_completed) continue
    if (t.estimate_hours == null) continue
    const est = Number(t.estimate_hours)
    if (!(est > 0)) continue
    const act = Number(t.actual_hours)
    if (!(act > 0)) continue
    if (!t.completed_on) continue
    const monthKey = t.completed_on.slice(0, 7) + '-01'
    const bucket = ratiosByMonth.get(monthKey)
    if (!bucket) continue
    bucket.push(act / est)
  }

  return months.map((m) => {
    const ratios = ratiosByMonth.get(m) ?? []
    return {
      month: m,
      label: formatMonthLabel(m),
      median_overrun_ratio: median(ratios),
      p25: percentile(ratios, 0.25),
      p75: percentile(ratios, 0.75),
      sample_size: ratios.length,
    }
  })
}

function barColor(ratio: number | null): string {
  if (ratio == null) return '#e5e5e5'
  if (ratio >= 2) return '#dc2626'      // red-600
  if (ratio >= 1.5) return '#d97706'    // amber-600
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
            <span className="text-neutral-500">Median:</span>{' '}
            <span className="font-medium">{formatRatioPct(row.median_overrun_ratio)}</span>
          </div>
          <div>
            <span className="text-neutral-500">p25–p75:</span>{' '}
            <span className="font-medium">{formatRatioPct(row.p25)} – {formatRatioPct(row.p75)}</span>
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

function formatRatioPct(r: number | null | undefined): string {
  if (r == null) return '—'
  return `${Math.round(r * 100)}%`
}

export function EstimateAccuracyChart({
  tasks,
  range,
}: {
  tasks: TaskActualVsEstimate[]
  range: DashboardPeriodRange
}) {
  const data = useMemo(() => buildBuckets(tasks, range), [tasks, range])
  const hasAny = data.some((d) => d.sample_size > 0)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">Estimate accuracy over time</h3>
        <p className="text-xs text-neutral-500">
          Median overrun ratio for tasks with an estimate and logged time. Sample size shown on the right axis.
        </p>
      </div>
      <div className="px-2 py-4" style={{ height: 300 }}>
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
              <Bar yAxisId="left" dataKey="median_overrun_ratio" name="Median ratio">
                {data.map((d) => (
                  <Cell
                    key={d.month}
                    fill={barColor(d.median_overrun_ratio)}
                    fillOpacity={d.sample_size === 0 ? 0.15 : 0.75}
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
