import type { WriteoffSegmentRow } from '@/lib/queries'
import { formatHours } from '@/lib/format'
import { workModelLabel } from '@/lib/writeoffPolicy'

/**
 * §2's "segment or lie", applied to write-off.
 *
 * Fixed-scope and maintenance work write off at very different rates, and
 * T&M / outstaff writes off essentially nothing because the model bills the
 * hour rather than the outcome. One company average across the three describes
 * no actual engagement — which is §1.5's diagnosis of how the old dashboard
 * became meaningless.
 *
 * Rendered as a bar per segment rather than a table: the comparison is the
 * content, and three numbers in a column make the reader do the comparing.
 */
export function SegmentSplit({
  segments,
  emptyText,
}: {
  segments: WriteoffSegmentRow[]
  emptyText: string
}) {
  const withHours = segments.filter((s) => s.billable_hours + s.non_billable_hours > 0)

  if (withHours.length === 0) {
    return <div className="px-4 py-6 text-xs text-neutral-400">{emptyText}</div>
  }

  const maxPct = withHours.reduce((m, s) => Math.max(m, s.writeoff_pct ?? 0), 0)

  return (
    <div className="divide-y divide-neutral-100">
      {withHours.map((s) => {
        const width = maxPct > 0 ? ((s.writeoff_pct ?? 0) / maxPct) * 100 : 0
        return (
          <div key={`${s.work_model}-${String(s.is_in_scope)}`} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-neutral-900">
                {workModelLabel(s.work_model)}
              </span>
              <span className="tabular-nums">
                <span className="text-base font-bold text-neutral-900">
                  {s.writeoff_pct == null ? '—' : `${s.writeoff_pct.toFixed(1)}%`}
                </span>{' '}
                <span className="text-[11px] text-neutral-500">
                  {formatHours(s.non_billable_hours)} of{' '}
                  {formatHours(s.non_billable_hours + s.billable_hours)} tagged
                </span>
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-700"
                style={{ width: `${width}%` }}
              />
            </div>
            {s.untagged_hours > 0 ? (
              <div className="mt-1 text-[11px] text-indigo-600">
                + {formatHours(s.untagged_hours)} untagged (Jira) — outside the denominator, not
                counted as billable
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
