import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BUCKET_COLORS, BUCKET_LABELS, type UtilizationBucket, type UtilizationSummary } from '@/lib/utilization'

type Props = { summary: UtilizationSummary }

// Order matters for legend readability: tracked first, then absences, then missing.
const SLICE_ORDER: UtilizationBucket[] = [
  'tracked',
  'vacation',
  'sick',
  'unpaid_leave',
  'other_absence',
  'missing',
]

export function UtilizationDonut({ summary }: Props) {
  // Recharts 3 reads `fill` from each data item directly — using <Cell>
  // children inside <Pie> made the chart compute angles from the cells
  // (rendering as a tiny ~28° wedge) instead of from the data values.
  const data = SLICE_ORDER
    .map((bucket) => ({
      bucket,
      label: BUCKET_LABELS[bucket],
      value: summary.buckets[bucket],
      fill: BUCKET_COLORS[bucket],
    }))
    .filter((s) => s.value > 0)

  if (summary.workingHours === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
        No working days in this period.
      </div>
    )
  }

  const trackedPct = Math.round((summary.trackedHours / summary.workingHours) * 100)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Working time</h3>
          <p className="text-xs text-neutral-500">
            {summary.from} → {summary.to} · {summary.workingDayCount} working days · {summary.workingHours.toFixed(0)}h
          </p>
        </div>
        <p className="text-xs text-neutral-400">
          weekends + holidays excluded from this chart
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
                startAngle={90}
                endAngle={-270}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              />
              {/* Sector colors come from each data item's `fill` field. */}
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => [`${Number(value ?? 0).toFixed(1)}h`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold text-neutral-900">{trackedPct}%</div>
            <div className="text-xs text-neutral-500">
              {summary.trackedHours.toFixed(0)}h / {summary.workingHours.toFixed(0)}h
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">
              Tracked / Working
            </div>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-1 self-center text-xs">
          {data.map((s) => {
            const pct = summary.workingHours > 0 ? Math.round((s.value / summary.workingHours) * 100) : 0
            return (
              <li key={s.bucket} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-neutral-50">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.fill }}
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
