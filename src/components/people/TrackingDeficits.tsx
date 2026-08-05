import { Panel } from '@/components/estimation/Section'
import { formatDate, formatHours } from '@/lib/format'
import type { TrackingDeficit } from '@/lib/queries'

/**
 * §4.5 logging hygiene: "tracking-deficit history mined from the existing
 * `reminder_deliveries` table (it already stores expected/tracked/deficit per
 * person per period — free longitudinal data, zero new sync work)".
 *
 * The honest part is the empty state. Rows exist only where the Slack reminder
 * system actually ran — 35 people over 2026-05-01 → 2026-07-20 at time of
 * writing — so **no rows means no history, not a clean record**, and saying
 * "0h deficit" for someone the reminders never covered would invent a
 * compliment. Same class of bug as F3's "0 signals means healthy".
 */
export function TrackingDeficits({ rows }: { rows: TrackingDeficit[] }) {
  const measured = rows.filter((r) => r.status !== 'skipped_zero_expected')
  const recent = measured.slice(-8)
  const totalDeficit = measured.reduce((s, r) => s + r.deficit_hours, 0)

  return (
    <Panel
      title="Logging hygiene"
      blurb="Tracking deficit per period, from the Slack reminder system's own delivery record."
      meta={measured.length > 0 ? `${measured.length} periods` : undefined}
    >
      <div className="p-3">
        {measured.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            <span className="font-medium text-neutral-700">No reminder history for this person.</span>{' '}
            The tracking reminders have only ever run for part of the team, so an absence here means
            nothing was recorded — not that nothing was missed. Read it as “unknown”, not “clean”.
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xs text-neutral-600">
                Cumulative shortfall{' '}
                <span
                  className={`text-sm font-bold tabular-nums ${
                    totalDeficit > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {formatHours(totalDeficit)}
                </span>{' '}
                across {measured.length} measured period{measured.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
              {recent.map((r) => (
                <li
                  key={`${r.kind}-${r.period_start}`}
                  className="flex items-baseline gap-2 px-2 py-1.5 text-xs"
                >
                  <span className="w-24 shrink-0 text-neutral-500">
                    {formatDate(r.period_start)}
                  </span>
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-neutral-400">
                    {r.kind}
                  </span>
                  <span className="flex-1 tabular-nums text-neutral-600">
                    {formatHours(r.tracked_hours)} / {formatHours(r.expected_hours)}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${
                      r.deficit_hours > 0 ? 'font-medium text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {r.deficit_hours > 0 ? `−${formatHours(r.deficit_hours)}` : 'met'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
              Expected hours come from the same PeopleForce capacity the utilization donut uses.
              A deficit is unlogged time, which is a tracking gap — it is not evidence that the work
              did not happen.
            </p>
          </>
        )}
      </div>
    </Panel>
  )
}
