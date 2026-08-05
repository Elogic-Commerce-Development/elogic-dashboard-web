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
  type TooltipContentProps,
} from 'recharts'
import type { CoverageMonth } from '@/lib/queries'

type Point = CoverageMonth & { label: string; partial: boolean }

function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

function TrendTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as Point
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-neutral-900">
        {row.label}
        {row.partial ? ' · month in progress' : ''}
      </div>
      <div className="mt-1 space-y-0.5 tabular-nums text-neutral-700">
        <div>
          <span className="text-neutral-500">Unestimated:</span>{' '}
          <span className="font-medium text-red-600">{row.unestimated_hours.toFixed(1)}h</span>
        </div>
        <div>
          <span className="text-neutral-500">Estimated:</span>{' '}
          <span className="font-medium text-emerald-700">{row.estimated_hours.toFixed(1)}h</span>
        </div>
        <div>
          <span className="text-neutral-500">Coverage:</span>{' '}
          <span className="font-medium">
            {row.coverage_pct == null ? '—' : `${row.coverage_pct.toFixed(1)}%`}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * §4.2's headline: "unestimated hours trend".
 *
 * Both halves of the month are stacked rather than plotting unestimated hours
 * alone, because the number that matters is a *share* — 400h unpriced in a
 * 500h month and in a 2,000h month are different situations, and a lone red
 * bar cannot tell them apart. The coverage line on the right axis is the same
 * quantity Radar's vitals tile shows, read from the same view.
 *
 * The month in progress is drawn at reduced opacity: it always looks like a
 * collapse on the 5th, and F3 already learned that lesson on the sparklines.
 */
export function CoverageTrendChart({ months }: { months: CoverageMonth[] }) {
  const data = useMemo<Point[]>(() => {
    const current = new Date()
    const currentMonth = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-01`
    return months.map((m) => ({
      ...m,
      label: monthLabel(m.month),
      partial: m.month === currentMonth,
    }))
  }, [months])

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-xs text-neutral-400">
        No monthly hours in the estimating segments yet.
      </div>
    )
  }

  return (
    <div className="px-2 py-4" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v))}h`} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
          />
          <Tooltip content={(props) => <TrendTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" stackId="hours" dataKey="unestimated_hours" name="Unestimated hours" fill="#dc2626">
            {data.map((d) => (
              <Cell key={d.month} fill="#dc2626" fillOpacity={d.partial ? 0.3 : 0.75} />
            ))}
          </Bar>
          <Bar yAxisId="left" stackId="hours" dataKey="estimated_hours" name="Estimated hours" fill="#059669">
            {data.map((d) => (
              <Cell key={d.month} fill="#059669" fillOpacity={d.partial ? 0.25 : 0.65} />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="coverage_pct"
            name="Coverage %"
            stroke="#171717"
            strokeWidth={1.75}
            dot={{ r: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
