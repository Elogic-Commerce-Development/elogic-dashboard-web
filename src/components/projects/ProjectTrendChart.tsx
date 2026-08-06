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
import type { ProjectMonthRow } from '@/lib/queries'

type Point = ProjectMonthRow & { label: string; partial: boolean }

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
          <span className="text-neutral-500">Hours:</span>{' '}
          <span className="font-medium">{row.total_hours.toFixed(1)}h</span>
        </div>
        <div>
          <span className="text-neutral-500">— unestimated:</span>{' '}
          <span className="font-medium text-red-600">{row.hours_on_unestimated.toFixed(1)}h</span>
        </div>
        <div>
          <span className="text-neutral-500">Coverage:</span>{' '}
          <span className="font-medium">
            {row.coverage_pct == null ? '—' : `${row.coverage_pct.toFixed(1)}%`}
          </span>
        </div>
        <div>
          <span className="text-neutral-500">Team:</span>{' '}
          <span className="font-medium">{row.team_members}</span> ·{' '}
          <span className="text-neutral-500">tasks touched:</span>{' '}
          <span className="font-medium">{row.tasks_touched}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * §4.7's historical context: the project's monthly hours split
 * estimated/unestimated (same vocabulary as Estimation's coverage trend, read
 * from the same R8 view) with the coverage line on the right axis. For
 * non-estimating segments the split is meaningless, so the bars render as one
 * neutral series and the coverage line is dropped — §2's "segment or lie".
 */
export function ProjectTrendChart({
  months,
  isEstimatingSegment,
}: {
  months: ProjectMonthRow[]
  isEstimatingSegment: boolean
}) {
  const data = useMemo<Point[]>(() => {
    const now = new Date()
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
    return months.map((m) => ({ ...m, label: monthLabel(m.month), partial: m.month === currentMonth }))
  }, [months])

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-xs text-neutral-400">
        No monthly hours on record.
      </div>
    )
  }

  return (
    <div className="px-2 py-3" style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v))}h`} />
          {isEstimatingSegment ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(Number(v))}%`}
            />
          ) : null}
          <Tooltip content={(props) => <TrendTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {isEstimatingSegment ? (
            <>
              <Bar yAxisId="left" stackId="hours" dataKey="hours_on_unestimated" name="Unestimated hours" fill="#dc2626">
                {data.map((d) => (
                  <Cell key={d.month} fill="#dc2626" fillOpacity={d.partial ? 0.3 : 0.75} />
                ))}
              </Bar>
              <Bar yAxisId="left" stackId="hours" dataKey="hours_on_estimated" name="Estimated hours" fill="#059669">
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
            </>
          ) : (
            <Bar yAxisId="left" dataKey="total_hours" name="Hours" fill="#737373">
              {data.map((d) => (
                <Cell key={d.month} fill="#737373" fillOpacity={d.partial ? 0.35 : 0.75} />
              ))}
            </Bar>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
