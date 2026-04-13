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

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function formatHoursShort(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return Math.round(v).toString()
}

type ChartData = {
  label: string
  unestimatedTasks: number
  overrunTasks: number
  estimatedTasks: number
  adoptionPct: number
  unestimatedHours: number
  overrunHours: number
  estimatedHours: number
}

function prepareData(data: MonthlyTrend[]): ChartData[] {
  return data.map((d) => ({
    label: formatMonth(d.month),
    unestimatedTasks: Number(d.unestimated_tasks),
    overrunTasks: Number(d.overrun_tasks),
    estimatedTasks: Number(d.active_tasks) - Number(d.unestimated_tasks),
    adoptionPct: d.estimate_adoption_rate != null ? Math.round(Number(d.estimate_adoption_rate) * 100) : 0,
    unestimatedHours: Math.round(Number(d.unestimated_hours)),
    overrunHours: Math.round(Number(d.overrun_hours)),
    estimatedHours: Math.round(Number(d.total_hours) - Number(d.unestimated_hours)),
  }))
}

export function TrendCharts({ data }: { data: MonthlyTrend[] }) {
  if (data.length === 0) return null
  const chartData = prepareData(data)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Estimation adoption over time</h3>
          <p className="text-xs text-neutral-500">Monthly task counts with/without estimates, and adoption rate.</p>
        </div>
        <div className="px-2 py-4" style={{ height: 300 }}>
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
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Hours breakdown over time</h3>
          <p className="text-xs text-neutral-500">Monthly hours on estimated vs unestimated tasks, and overrun hours.</p>
        </div>
        <div className="px-2 py-4" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatHoursShort} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => [`${Number(value).toLocaleString()}h`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="estimatedHours" name="Hours on estimated" stackId="hours" fill="#059669" fillOpacity={0.7} />
              <Bar dataKey="unestimatedHours" name="Hours on unestimated" stackId="hours" fill="#dc2626" fillOpacity={0.7} />
              <Line type="monotone" dataKey="overrunHours" name="Overrun hours" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
