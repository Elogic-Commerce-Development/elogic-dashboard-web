import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { MonthlyTrend } from '@/lib/queries'
import type { DashboardPeriodRange } from '@/lib/dashboardPeriod'

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

type ChartRow = {
  label: string
  unestimatedTasks: number
  estimatedTasks: number
  adoptionPct: number
}

function prepareData(data: MonthlyTrend[], range: DashboardPeriodRange): ChartRow[] {
  return data
    .filter((d) => d.month >= range.from && d.month <= range.to)
    .map((d) => ({
      label: formatMonth(d.month),
      unestimatedTasks: Number(d.unestimated_tasks),
      estimatedTasks: Number(d.active_tasks) - Number(d.unestimated_tasks),
      adoptionPct:
        d.estimate_adoption_rate != null ? Math.round(Number(d.estimate_adoption_rate) * 100) : 0,
    }))
}

export function EstimationAdoptionChart({
  data,
  range,
}: {
  data: MonthlyTrend[]
  range: DashboardPeriodRange
}) {
  const chartData = useMemo(() => prepareData(data, range), [data, range])

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">Estimation adoption over time</h3>
        <p className="text-xs text-neutral-500">Monthly task counts with/without estimates, and adoption rate.</p>
      </div>
      <div className="px-2 py-4" style={{ height: 300 }}>
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            No activity in this period yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => {
                  if (name === 'Adoption %') return [`${value}%`, name]
                  return [value, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="estimatedTasks" name="Estimated tasks" stackId="tasks" fill="#059669" fillOpacity={0.7} />
              <Bar yAxisId="left" dataKey="unestimatedTasks" name="Unestimated tasks" stackId="tasks" fill="#dc2626" fillOpacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="adoptionPct" name="Adoption %" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
