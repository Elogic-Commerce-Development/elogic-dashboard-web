import type { LadderRung } from '@/lib/quality'
import { formatPct } from '@/lib/quality'
import { QA_ITERATIONS_CAP } from '@/lib/qualityPolicy'

/**
 * §4.3's rework cost ladder: "avg actual hours and overrun rate by iteration
 * count … **frames returns as hours, not counts**".
 *
 * That framing is the whole point, so hours are the hero of each rung and the
 * bar is drawn proportional to them. A ticket returned once costs ~1.5× a
 * clean one; returned twice or more it costs ~3×. Counting returns says
 * "104 tickets came back"; costing them says "those 104 tickets ate 2,500
 * hours", which is the sentence that changes a decision.
 *
 * Overrun rate sits beside it as a share of the rung's **estimated** tasks —
 * an unestimated task cannot overrun (§5 computes overrun over estimated
 * tasks), so including unestimated work in the denominator would report the
 * least overrun on the projects with the worst estimation coverage.
 */
export function ReworkLadder({ rungs }: { rungs: LadderRung[] }) {
  const maxHours = rungs.reduce((m, r) => Math.max(m, r.avg_actual_hours ?? 0), 0)
  const totalTasks = rungs.reduce((s, r) => s + r.tasks, 0)

  if (totalTasks === 0) {
    return (
      <div className="px-4 py-6 text-xs text-neutral-400">
        No completed task carries a QA iteration count yet.
      </div>
    )
  }

  return (
    <div className="divide-y divide-neutral-100">
      {rungs.map((rung) => {
        const width = maxHours > 0 ? ((rung.avg_actual_hours ?? 0) / maxHours) * 100 : 0
        const multiple =
          rungs[0].avg_actual_hours && rung.avg_actual_hours
            ? rung.avg_actual_hours / rungs[0].avg_actual_hours
            : null
        return (
          <div key={rung.bucket} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-neutral-900">
                  {rung.label} QA {rung.bucket === 1 ? 'round' : 'rounds'}
                </span>
                <span className="text-xs text-neutral-500">n={rung.tasks}</span>
                {rung.bucket === 3 ? (
                  <span
                    className="text-[10px] text-neutral-400"
                    title={`Iterations are capped at ${QA_ITERATIONS_CAP} upstream, so this rung understates the worst tickets rather than overstating them.`}
                  >
                    ⓘ
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-4 tabular-nums">
                <span className="text-lg font-bold text-neutral-900">
                  {rung.avg_actual_hours == null ? '—' : `${rung.avg_actual_hours.toFixed(1)}h`}
                </span>
                {multiple != null && rung.bucket !== 1 ? (
                  <span className="text-xs font-medium text-red-600">
                    ×{multiple.toFixed(1)} a clean ticket
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className={
                  rung.bucket === 1
                    ? 'h-full rounded-full bg-emerald-500'
                    : rung.bucket === 2
                      ? 'h-full rounded-full bg-amber-500'
                      : 'h-full rounded-full bg-red-500'
                }
                style={{ width: `${width}%` }}
              />
            </div>

            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-neutral-500">
              <span>
                Overruns{' '}
                <span className="font-medium tabular-nums text-neutral-700">
                  {formatPct(rung.overrun_rate_pct)}
                </span>{' '}
                ({rung.overrun_tasks} of {rung.estimated_tasks} estimated)
              </span>
              <span className="tabular-nums">
                {rung.total_actual_hours.toFixed(1)}h total on this rung
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
