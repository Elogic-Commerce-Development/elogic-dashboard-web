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
import type { QualityMonth } from '@/lib/quality'
import { returnedRateTone } from '@/lib/qualityPolicy'

type Point = QualityMonth & { label: string; partial: boolean }

function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

const TONE_FILL: Record<string, string> = {
  red: '#dc2626',
  amber: '#d97706',
  emerald: '#059669',
  neutral: '#a3a3a3',
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
      {row.qa_covered_tasks === 0 ? (
        <div className="mt-1 text-neutral-500">
          {row.completed_tasks === 0
            ? 'No in-scope task completed this month.'
            : `${row.completed_tasks} tasks completed, none carrying a QA iteration count — nothing was measured.`}
        </div>
      ) : (
        <div className="mt-1 space-y-0.5 tabular-nums text-neutral-700">
          <div>
            <span className="text-neutral-500">Returned:</span>{' '}
            <span className="font-medium">
              {row.returned_pct == null ? '—' : `${row.returned_pct.toFixed(1)}%`}
            </span>{' '}
            <span className="text-neutral-500">
              ({row.returned_tasks} of n={row.qa_covered_tasks})
            </span>
          </div>
          <div>
            <span className="text-neutral-500">QA coverage:</span>{' '}
            <span className="font-medium">
              {row.coverage_pct == null ? '—' : `${row.coverage_pct.toFixed(1)}%`}
            </span>{' '}
            <span className="text-neutral-500">
              ({row.qa_covered_tasks} of {row.completed_tasks} completed)
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Avg actual:</span>{' '}
            <span className="font-medium">
              {row.avg_actual_hours == null ? '—' : `${row.avg_actual_hours.toFixed(1)}h`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * §5's returned rate over time — the share of QA-covered completed tasks sent
 * back for a 2nd+ round, by completion month.
 *
 * The coverage line is not decoration — §5 requires it ("Coverage % always
 * shown"), and on this data it is the more honest of the two series. Coverage
 * swings from 0% for the whole first eight months to 52.5% in November 2025 and
 * back to 5.4% in April 2026, so a returned rate plotted alone invites a reader
 * to see a quality trend in what is mostly a change in how many tickets anybody
 * labelled. The exact n sits in the tooltip beside it.
 *
 * Months with no QA-covered completion render as a gap with an explicit
 * tooltip rather than a zero — "nothing was returned" and "nothing was
 * measured" are different claims, and F3's deployed pass caught this page's
 * ancestor making the first one when it meant the second.
 */
export function ReturnedRateTrend({ months }: { months: QualityMonth[] }) {
  const data = useMemo<Point[]>(() => {
    const now = new Date()
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
    return months.map((m) => ({
      ...m,
      label: monthLabel(m.month),
      partial: m.month === currentMonth,
    }))
  }, [months])

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-xs text-neutral-400">
        No QA-covered completed task carries an iteration count yet.
      </div>
    )
  }

  return (
    <div className="px-2 py-4" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
          />
          <Tooltip content={(props) => <TrendTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {/* See WriteoffTrendChart: the legend swatch reads the Bar's own
              `fill`, not the per-month Cells. */}
          <Bar yAxisId="left" dataKey="returned_pct" name="Returned rate %" fill="#737373">
            {data.map((d) => (
              <Cell
                key={d.month}
                fill={TONE_FILL[returnedRateTone(d.returned_pct)]}
                fillOpacity={d.partial ? 0.3 : 0.8}
              />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="coverage_pct"
            name="QA coverage %"
            stroke="#171717"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={{ r: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
