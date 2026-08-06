import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipContentProps,
} from 'recharts'
import type { BulkCloseDay, ProjectFlowRow } from '@/lib/queries'
import { formatDate } from '@/lib/format'

type Point = {
  month: string
  label: string
  created: number
  completed: number
  bulk_closed: number
  partial: boolean
}

function monthOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

function FlowTooltip({ active, payload }: TooltipContentProps) {
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
          <span className="text-neutral-500">Created:</span> <span className="font-medium">{row.created}</span>
        </div>
        <div>
          <span className="text-neutral-500">Completed:</span>{' '}
          <span className="font-medium text-emerald-700">{row.completed}</span>
        </div>
        {row.bulk_closed > 0 ? (
          <div>
            <span className="text-neutral-500">Bulk-closed:</span>{' '}
            <span className="font-medium text-neutral-500">{row.bulk_closed}</span>{' '}
            <span className="text-neutral-400">(excluded from the trend)</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * §4.7's backlog-flow chart: tasks created vs completed per month.
 *
 * §5's bulk-close rule applies: completions falling on a `v_bulk_close_days`
 * day (≥ 20 completions on one project-day — mass-close and import artifacts)
 * are pulled out of the Completed series and shown as their own grey stack
 * plus a caption, so a bootstrap mass-close reads as the event it was rather
 * than a heroic month. The exclusion predicate is the view's; this component
 * only buckets dates.
 */
export function BacklogFlowChart({
  rows,
  bulkDays,
}: {
  rows: ProjectFlowRow[]
  bulkDays: BulkCloseDay[]
}) {
  const { data, bulkNotes } = useMemo(() => {
    const bulkSet = new Set(bulkDays.map((d) => d.close_date))
    const byMonth = new Map<string, { created: number; completed: number; bulk: number }>()
    const bucket = (m: string) => {
      let b = byMonth.get(m)
      if (!b) {
        b = { created: 0, completed: 0, bulk: 0 }
        byMonth.set(m, b)
      }
      return b
    }
    for (const r of rows) {
      bucket(monthOf(r.created_on)).created += 1
      if (r.completed_on) {
        const day = r.completed_on.slice(0, 10)
        const b = bucket(monthOf(r.completed_on))
        if (bulkSet.has(day)) b.bulk += 1
        else b.completed += 1
      }
    }
    if (byMonth.size === 0) return { data: [] as Point[], bulkNotes: [] as string[] }

    const months = Array.from(byMonth.keys()).sort()
    const now = new Date()
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
    // Fill gaps so a quiet month renders as zero, not as a missing bar.
    const axis: string[] = []
    const cursor = new Date(months[0] + 'T00:00:00Z')
    const last = new Date(
      (months[months.length - 1] > currentMonth ? months[months.length - 1] : currentMonth) + 'T00:00:00Z',
    )
    while (cursor <= last) {
      axis.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
    const data = axis.map((m) => {
      const b = byMonth.get(m)
      return {
        month: m,
        label: monthLabel(m),
        created: b?.created ?? 0,
        completed: b?.completed ?? 0,
        bulk_closed: b?.bulk ?? 0,
        partial: m === currentMonth,
      }
    })
    // Only days the guard flagged AND that actually hit this task set get a note
    // (a guard day's completions can include tasks created before the 2025 floor).
    const hit = bulkDays.filter((d) => rows.some((r) => r.completed_on?.slice(0, 10) === d.close_date))
    const bulkNotes = hit.map((d) => `${d.completions} tasks bulk-closed on ${formatDate(d.close_date)}`)
    return { data, bulkNotes }
  }, [rows, bulkDays])

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-xs text-neutral-400">
        No in-scope tasks yet (tasks created since 2025-01-01).
      </div>
    )
  }

  return (
    <div>
      <div className="px-2 py-3" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={(props) => <FlowTooltip {...props} />} cursor={{ fill: '#f5f5f5' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="created" name="Created" fill="#a3a3a3" fillOpacity={0.8} />
            <Bar stackId="done" dataKey="completed" name="Completed" fill="#059669" fillOpacity={0.7} />
            <Bar stackId="done" dataKey="bulk_closed" name="Bulk-closed (excluded)" fill="#d4d4d4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {bulkNotes.length > 0 ? (
        // The day threshold behind "bulk-close" lives in v_metric_config on the
        // database, so the copy names the phenomenon, not the trigger value.
        <p className="border-t border-neutral-100 px-3 py-2 text-[11px] leading-snug text-neutral-500">
          Bulk-close events (mass-close/import days flagged by §5's guard, all task vintages —
          counted apart; the grey stack shows only the in-scope share): {bulkNotes.join(' · ')}.
        </p>
      ) : null}
    </div>
  )
}
