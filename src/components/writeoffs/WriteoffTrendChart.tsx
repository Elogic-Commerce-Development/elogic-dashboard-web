import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipContentProps,
} from 'recharts'
import type { WriteoffMonth } from '@/lib/writeoffs'
import { MONTHLY_ALERT_PCT, monthlyWriteoffTone } from '@/lib/writeoffPolicy'

type Point = WriteoffMonth & { label: string }

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
      <div className="mt-1 space-y-0.5 tabular-nums text-neutral-700">
        <div>
          <span className="text-neutral-500">Company:</span>{' '}
          <span className="font-medium">
            {row.company_pct == null ? '—' : `${row.company_pct.toFixed(1)}%`}
          </span>
        </div>
        <div>
          <span className="text-neutral-500">In-scope delivery:</span>{' '}
          <span className="font-medium">
            {row.in_scope_pct == null ? '—' : `${row.in_scope_pct.toFixed(1)}%`}
          </span>
        </div>
        <div className="pt-1 text-neutral-500">
          {row.company_non_billable.toFixed(1)}h written off of{' '}
          {(row.company_non_billable + row.company_billable).toFixed(1)}h tagged
        </div>
        {row.untagged_hours > 0 ? (
          <div className="text-neutral-500">
            + {row.untagged_hours.toFixed(1)}h untagged (Jira), outside the denominator
          </div>
        ) : null}
        {row.partial ? (
          <div className="pt-1 text-amber-700">
            Partial month — not comparable to a closed one.
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * §4.4's headline: "Monthly write-off % vs baseline and a 10% alert line".
 *
 * Two series, because they answer two questions and disagree sharply. The
 * company bars are the population §5's 8.8% baseline is pinned against; the
 * in-scope line is the 65 delivery projects, which run 2–4× higher and are the
 * hours a delivery manager can actually act on. Blending them would produce a
 * number that describes neither — §2's "segment or lie".
 *
 * Bars are toned against the two lines the chart already draws (baseline, then
 * the 10% alert), so the colour is never a third opinion.
 *
 * The month in progress is drawn at reduced opacity and excluded from the
 * baseline: a month three days old reads 42.8% purely because a little
 * non-billable admin lands before the billable delivery hours do, and plotting
 * that like a closed month manufactures exactly the drift this chart exists to
 * detect. F3 learned the same lesson on the Radar sparklines.
 */
export function WriteoffTrendChart({
  months,
  baselinePct,
}: {
  months: WriteoffMonth[]
  baselinePct: number | null
}) {
  const data = useMemo<Point[]>(
    () =>
      months.map((m) => ({
        ...m,
        label: monthLabel(m.month),
        // The bars fade the in-progress month; the line has to drop it outright.
        // A line segment reaching 64.9% because three days of admin landed
        // before any delivery hours is not a trend, and unlike a faded bar a
        // line point reads as continuous with the closed months beside it.
        in_scope_pct: m.partial ? null : m.in_scope_pct,
      })),
    [months],
  )

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-xs text-neutral-400">
        No tagged time records since the 2025 floor.
      </div>
    )
  }

  return (
    <div className="px-2 py-4" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
          />
          <Tooltip content={(props) => <TrendTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {baselinePct != null ? (
            <ReferenceLine
              yAxisId="left"
              y={baselinePct}
              stroke="#737373"
              strokeDasharray="4 4"
              label={{
                value: `Baseline ${baselinePct.toFixed(1)}%`,
                position: 'right',
                fontSize: 10,
                fill: '#737373',
              }}
            />
          ) : null}
          <ReferenceLine
            yAxisId="left"
            y={MONTHLY_ALERT_PCT}
            stroke="#dc2626"
            strokeDasharray="4 4"
            label={{
              value: `Alert ${MONTHLY_ALERT_PCT}%`,
              position: 'right',
              fontSize: 10,
              fill: '#dc2626',
            }}
          />
          {/* `fill` on the Bar is what the legend swatch reads; the Cells
              only re-colour the plotted bars. Without it the swatch renders
              black and the legend stops matching the chart. */}
          <Bar yAxisId="left" dataKey="company_pct" name="Company write-off %" fill="#737373">
            {data.map((d) => (
              <Cell
                key={d.month}
                fill={TONE_FILL[monthlyWriteoffTone(d.company_pct, baselinePct ?? MONTHLY_ALERT_PCT)]}
                fillOpacity={d.partial ? 0.28 : 0.8}
              />
            ))}
          </Bar>
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="in_scope_pct"
            name="In-scope delivery %"
            stroke="#171717"
            strokeWidth={1.75}
            dot={{ r: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
