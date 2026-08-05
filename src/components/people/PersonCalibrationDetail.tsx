import { useMemo } from 'react'
import { Panel, StatTile } from '@/components/estimation/Section'
import { CalibrationStrip } from '@/components/people/CalibrationStrip'
import { TrustFlagNote } from '@/components/people/TrustFlagNote'
import {
  QUARTER_DISPLAY_MIN,
  calibrationState,
  toQuarters,
  trustFlag,
} from '@/lib/peopleCoaching'
import type { PersonCalibration, PersonCalibrationTask } from '@/lib/queries'

/**
 * §4.5 person detail: "personal calibration history (quarterly) … and their
 * trust-flag detail — **not just the exact-match share over time but the
 * mechanism evidence** (entries per task, distinct record dates, batch-session
 * pattern), because §1.6 showed that is what separates month-end block
 * allocation from fit-to-estimate logging, and each leads to a different
 * conversation."
 *
 * So the mechanism evidence renders for everyone at the floor, flagged or not
 * — it is context for reading the ratio, not a punishment attached to the
 * flag.
 */
export function PersonCalibrationDetail({
  calibration,
  allCalibration,
  sample,
  userId,
  floor,
}: {
  calibration: PersonCalibration | undefined
  allCalibration: PersonCalibration[]
  sample: PersonCalibrationTask[]
  userId: number
  floor: number
}) {
  const state = calibrationState(calibration, floor)
  const flag = trustFlag(calibration, floor)
  const quarters = useMemo(() => toQuarters(sample), [sample])

  return (
    <Panel
      title="Calibration"
      blurb="Actual ÷ estimate on completed tasks where this person logged at least 40% of the hours. Assignee-of-record is never used."
      meta={state.kind === 'shown' ? `n = ${state.c.n}` : undefined}
    >
      <div className="space-y-4 p-3">
        {state.kind === 'shown' ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label="Median ratio"
                value={state.c.median_ratio?.toFixed(3) ?? '—'}
                caption={`over ${state.c.n} attributed tasks`}
                emphasis
              />
              <StatTile
                label="p90 (tail risk)"
                value={state.c.p90_ratio?.toFixed(2) ?? '—'}
                caption="1 task in 10 runs at least this far over"
              />
              <StatTile
                label="In band"
                value={state.c.in_band_pct == null ? '—' : `${state.c.in_band_pct.toFixed(1)}%`}
                caption="ratio within 0.8–1.2"
              />
              <StatTile
                label="Exact match"
                value={
                  state.c.exact_match_pct == null ? '—' : `${state.c.exact_match_pct.toFixed(1)}%`
                }
                caption="ratio within 0.99–1.01 · team baseline ~14–19%"
                tone={state.c.exact_match_flagged ? 'amber' : 'neutral'}
              />
            </div>

            {flag && <TrustFlagNote flag={flag} />}

            {/* Mechanism evidence — shown for everyone at the floor. */}
            <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                How the time was logged
              </h4>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                Their attributed tasks carry{' '}
                <span className="font-medium tabular-nums text-neutral-900">
                  {state.c.avg_entries_per_task?.toFixed(2) ?? '—'}
                </span>{' '}
                time entries across{' '}
                <span className="font-medium tabular-nums text-neutral-900">
                  {state.c.avg_distinct_dates_per_task?.toFixed(2) ?? '—'}
                </span>{' '}
                distinct dates on average. Roughly one entry on one date per task is the shape
                month-end block allocation makes; many entries over many days is the shape genuine
                as-you-go tracking makes. This is context for reading the ratio above — on its own
                it says nothing about whether an estimate was good.
              </p>
            </div>

            <QuarterHistory quarters={quarters} floor={floor} />

            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                Where they sit in the team
              </h4>
              <CalibrationStrip all={allCalibration} highlightUserId={userId} floor={floor} />
            </div>
          </>
        ) : state.kind === 'below-floor' ? (
          <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <p className="text-xs font-medium text-neutral-700">
              Calibration is not shown for this person: n = {state.n}, below the floor of {state.floor}.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              A median over {state.n} task{state.n === 1 ? '' : 's'} moves by large amounts on a
              single task, so publishing one would give a false sense of measurement — including
              the exact-match trust flag, which is why no flag appears here either. §5 sets the
              floor at {state.floor} attributed completed tasks. Duplicate accounts are merged
              before the floor is applied, so a split identity is not what is holding this number
              down.
            </p>
          </div>
        ) : (
          <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <p className="text-xs font-medium text-neutral-700">
              No completed estimated task is attributed to this person.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              They may have worked on plenty — attribution requires holding at least 40% of a
              task&rsquo;s logged hours, so someone who spreads their time thinly across
              other people&rsquo;s tasks owns none of them outright. That is a statement about the
              shape of their work, not its quality.
            </p>
          </div>
        )}
      </div>
    </Panel>
  )
}

/**
 * §1.3: "Monthly per-person trends are statistical noise; quarterly works."
 *
 * Even quarterly, a per-person bucket runs n = 1–22 at today's volumes, so
 * every quarter carries its n and thin ones render muted. Suppressing them
 * entirely would hide most of several people's histories; showing them at full
 * weight would be the "misleading precision" §4.5 rules out. Muted-with-n is
 * the honest middle.
 */
function QuarterHistory({ quarters, floor }: { quarters: ReturnType<typeof toQuarters>; floor: number }) {
  if (quarters.length === 0) return null

  const solid = quarters.filter((q) => q.n >= QUARTER_DISPLAY_MIN)

  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
        Quarterly history
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {quarters.map((q) => {
          const thin = q.n < QUARTER_DISPLAY_MIN
          return (
            <div
              key={q.key}
              className={`min-w-[74px] rounded border px-2 py-1.5 ${
                thin ? 'border-dashed border-neutral-200 bg-white' : 'border-neutral-200 bg-white'
              }`}
              title={
                thin
                  ? `${q.n} task${q.n === 1 ? '' : 's'} in this quarter — too few to read as a trend point`
                  : `${q.n} tasks`
              }
            >
              <div className="text-[10px] text-neutral-500">{q.key}</div>
              <div
                className={`text-sm font-bold tabular-nums ${
                  thin ? 'text-neutral-400' : 'text-neutral-900'
                }`}
              >
                {q.median_ratio.toFixed(2)}
              </div>
              <div className="text-[10px] tabular-nums text-neutral-400">
                n={q.n} · {Math.round(q.exact_match_pct)}% exact
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
        Median ratio per quarter, bucketed by the date each task was completed.{' '}
        {solid.length < 2 ? (
          <>
            Too few quarters carry {QUARTER_DISPLAY_MIN}+ completed tasks to read a direction from
            this — the numbers are shown so you can see the shape, not to support a trend claim.
          </>
        ) : (
          <>
            Dashed quarters hold fewer than {QUARTER_DISPLAY_MIN} tasks and should be read as
            texture, not signal. The n ≥ {floor} floor applies to the all-time figures above; no
            single quarter here reaches it.
          </>
        )}
      </p>
    </div>
  )
}
