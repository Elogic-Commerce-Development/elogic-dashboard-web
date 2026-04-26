import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BUCKET_COLORS, BUCKET_LABELS, type UtilizationBucket, type UtilizationSummary } from '@/lib/utilization'

type Props = { summary: UtilizationSummary }

// Order matters for legend readability — work-related slices first, then leave, then idle.
const SLICE_ORDER: UtilizationBucket[] = [
  'tracked',
  'over_tracked',
  'untracked_working',
  'vacation',
  'sick',
  'other_paid',
  'other_unpaid',
  'bench',
  'holiday',
  'weekend',
]

export function UtilizationDonut({ summary }: Props) {
  const data = SLICE_ORDER
    .map((bucket) => ({
      bucket,
      label: BUCKET_LABELS[bucket],
      value: summary.buckets[bucket],
      color: BUCKET_COLORS[bucket],
    }))
    .filter((s) => s.value > 0)

  if (summary.chartTotal === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
        No data for this period.
      </div>
    )
  }

  const trackedPct = summary.expectedHours > 0
    ? Math.round((summary.trackedHours / summary.expectedHours) * 100)
    : 0

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">Time utilization</h3>
        <p className="text-xs text-neutral-500">
          {summary.from} → {summary.to} · {summary.totalDays} days
        </p>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="relative" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                stroke="#fff"
                strokeWidth={2}
              >
                {data.map((s) => (
                  <Cell key={s.bucket} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => [`${Number(value ?? 0).toFixed(1)}h`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold text-neutral-900">{trackedPct}%</div>
            <div className="text-xs text-neutral-500">
              {summary.trackedHours.toFixed(0)}h / {summary.expectedHours.toFixed(0)}h
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">Tracked / Expected</div>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-1 self-center text-xs">
          {data.map((s) => {
            const pct = summary.chartTotal > 0 ? Math.round((s.value / summary.chartTotal) * 100) : 0
            return (
              <li key={s.bucket} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-neutral-50">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-neutral-700">{s.label}</span>
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {s.value.toFixed(1)}h <span className="text-neutral-400">· {pct}%</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
