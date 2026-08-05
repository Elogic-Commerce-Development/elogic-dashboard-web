import {
  ResponsiveContainer,
  BarChart,
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  type TooltipContentProps,
} from 'recharts'
import type { HistogramBin, QuarterPoint, RatioBucket } from '@/lib/estimation'

/**
 * Colour carries meaning, never decoration (.impeccable.md #2): the in-band
 * bucket is the good outcome, the two under-run buckets are blue because an
 * estimate that was too *large* is a different failure from one that was too
 * small, and the two right-hand buckets escalate amber → red.
 */
const BUCKET_FILL: Record<RatioBucket, string> = {
  '<0.5': '#2563eb',
  '0.5–0.8': '#60a5fa',
  '0.8–1.2': '#059669',
  '1.2–2': '#d97706',
  '2–5': '#dc2626',
  '>5': '#991b1b',
}

function HistogramTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as HistogramBin
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-neutral-900">Ratio {row.bucket}</div>
      <div className="mt-1 space-y-0.5 tabular-nums text-neutral-700">
        <div>
          <span className="text-neutral-500">Tasks:</span>{' '}
          <span className="font-medium">
            {row.tasks} ({row.share_pct.toFixed(1)}%)
          </span>
        </div>
        <div>
          <span className="text-neutral-500">Estimated:</span>{' '}
          <span className="font-medium">{row.estimate_hours.toFixed(1)}h</span>
        </div>
        <div>
          <span className="text-neutral-500">Actual:</span>{' '}
          <span className="font-medium">{row.actual_hours.toFixed(1)}h</span>
        </div>
      </div>
    </div>
  )
}

/**
 * §4.2: the ratio *histogram*, "never a lone mean: mean 1.54 vs median 1.00 is
 * the whole story". A single average of this distribution is meaningless — the
 * mass sits on the estimate and a long right tail drags the mean above it.
 */
export function RatioHistogram({ bins }: { bins: HistogramBin[] }) {
  return (
    <div className="px-2 py-4" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 16, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={(props) => <HistogramTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
          <Bar dataKey="tasks" name="Tasks">
            {bins.map((b) => (
              <Cell key={b.bucket} fill={BUCKET_FILL[b.bucket]} fillOpacity={0.85} />
            ))}
            <LabelList dataKey="tasks" position="top" style={{ fontSize: 11, fill: '#525252' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function QuarterTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as QuarterPoint
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-neutral-900">{row.quarter}</div>
      <div className="mt-1 space-y-0.5 tabular-nums text-neutral-700">
        <div>
          <span className="text-neutral-500">In band (0.8–1.2):</span>{' '}
          <span className="font-medium text-emerald-700">{row.in_band_pct?.toFixed(1) ?? '—'}%</span>
        </div>
        <div>
          <span className="text-neutral-500">Blew 2×:</span>{' '}
          <span className="font-medium text-red-600">{row.blew_2x_pct?.toFixed(1) ?? '—'}%</span>
        </div>
        <div>
          <span className="text-neutral-500">Exact match:</span>{' '}
          <span className="font-medium">{row.exact_match_pct?.toFixed(1) ?? '—'}%</span>
        </div>
        <div>
          <span className="text-neutral-500">Completed, tracked:</span>{' '}
          <span className="font-medium">{row.n}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * §4.2's hero chart — the quarterly trend, where the blow-2× rate falling is
 * the good news the rest of this page does not contain.
 *
 * Sample size is plotted as bars behind the two rates, because a quarter with
 * eleven completions can swing thirty points on one task and the rate alone
 * hides that.
 */
export function CalibrationTrendChart({ points }: { points: QuarterPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-10 text-xs text-neutral-400">
        No completed estimated tasks to trend yet.
      </div>
    )
  }
  return (
    <div className="px-2 py-4" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
          />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={(props) => <QuarterTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="right" dataKey="n" name="Tasks completed" fill="#d4d4d4" fillOpacity={0.7} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="in_band_pct"
            name="In band (0.8–1.2)"
            stroke="#059669"
            strokeWidth={1.75}
            dot={{ r: 2 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="blew_2x_pct"
            name="Blew 2×"
            stroke="#dc2626"
            strokeWidth={1.75}
            dot={{ r: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
