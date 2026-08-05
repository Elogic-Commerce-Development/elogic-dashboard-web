import { useEffect, useMemo, useState } from 'react'
import { FreshnessStamp } from '@/components/radar/FreshnessStamp'
import { LoadFailure, Loading } from '@/components/estimation/Section'
import { PersonCard, type PersonCardData } from '@/components/people/PersonCard'
import { compareByDepartmentThenName } from '@/lib/peopleCoaching'
import { describeError } from '@/lib/errors'
import { formatHours } from '@/lib/format'
import {
  fetchActiveRoster,
  fetchCalibrationByPerson,
  fetchCoverageByPersonSplit,
  fetchMetricConfig,
  fetchPersonMonthSeries,
  fetchPersonUtilization,
  type PersonCalibration,
  type PersonMonthPoint,
  type PersonUtilization,
} from '@/lib/queries'

/** First of the last **complete** calendar month, as `YYYY-MM-01`. */
function lastCompleteMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function monthsAgo(n: number, now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

type State = {
  cards: PersonCardData[]
  floor: number
  hiddenCount: number
  hiddenHours: number
  month: string
}

const EMPTY: State = { cards: [], floor: 10, hiddenCount: 0, hiddenHours: 0, month: '' }

/**
 * People (plan §4.5) — "Who needs coaching, on what, with what evidence?"
 *
 * This is the page the plan reasons about most carefully, because it is the
 * one that measures individual colleagues on a tool management uses to
 * evaluate them. Three of its rules are non-negotiable and are enforced in
 * code, not left to layout:
 *
 *  1. **Suppress below the floor** (§4.5). Under §5's n ≥ 10 no calibration
 *     figure renders — not the median, not the exact-match share. Today 21 of
 *     the 37 people clear it; the other 16 show why they don't.
 *  2. **Questions, not verdicts** (§9). The exact-match trust flag renders as
 *     "timesheet mirrors estimate — is tracking real?" with its mechanism
 *     evidence and the question to ask. It never renders below the floor,
 *     which matters: the view's own `exact_match_flagged` is true for one
 *     person on a sample of **two**.
 *  3. **No ranking** (§2.5, §4.5). Grouped by department, ordered by name. No
 *     composite score, no sort control, no leaderboard.
 *
 * **No period switcher**, for the reason the Estimation page has none: the
 * figures here live at different grains on purpose — calibration is the
 * all-time §5 sample, coverage is all-time, load is the last complete month,
 * the trend is the last six — and a single page-level control would imply they
 * all move together. Each block states its own window instead.
 */
export function PeoplePage() {
  const [state, setState] = useState<State>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false

    async function load() {
      const month = lastCompleteMonth()
      const since = monthsAgo(5)
      try {
        const [roster, coverage, calibration, months, utilization, config] = await Promise.all([
          fetchActiveRoster(),
          fetchCoverageByPersonSplit(),
          fetchCalibrationByPerson(),
          fetchPersonMonthSeries(since),
          fetchPersonUtilization(month),
          fetchMetricConfig(),
        ])
        if (cancelled) return

        const calById = new Map<number, PersonCalibration>(calibration.map((c) => [c.user_id, c]))
        const utilById = new Map<number, PersonUtilization>(utilization.map((u) => [u.user_id, u]))
        const monthsById = new Map<number, PersonMonthPoint[]>()
        for (const m of months) {
          const list = monthsById.get(m.user_id) ?? []
          list.push(m)
          monthsById.set(m.user_id, list)
        }

        // Roll the two segment classes up separately: the headline hours are
        // every segment ("what they worked on"), the coverage denominator is
        // estimating segments only (§4.5).
        const agg = new Map<
          number,
          { hours: number; tasks: number; estHours: number; estimatedHours: number; unest: number }
        >()
        for (const c of coverage) {
          const a = agg.get(c.user_id) ?? {
            hours: 0,
            tasks: 0,
            estHours: 0,
            estimatedHours: 0,
            unest: 0,
          }
          a.hours += c.hours
          a.tasks += c.tasks
          if (c.is_estimating_segment) {
            a.estHours += c.hours
            a.estimatedHours += c.estimated_hours
            a.unest += c.unestimated_hours
          }
          agg.set(c.user_id, a)
        }

        const onRoster = new Set(roster.map((r) => r.user_id))
        const cards: PersonCardData[] = roster
          .filter((r) => agg.has(r.user_id))
          .map((r) => {
            const a = agg.get(r.user_id)!
            return {
              user_id: r.user_id,
              display_name: r.display_name,
              department_name: r.department_name,
              position_name: r.position_name,
              merged_identities: r.merged_identities,
              hours: a.hours,
              tasks: a.tasks,
              estimatingHours: a.estHours,
              estimatingUnestimatedHours: a.unest,
              coveragePct: a.estHours > 0 ? (a.estimatedHours / a.estHours) * 100 : null,
              calibration: calById.get(r.user_id),
              utilization: utilById.get(r.user_id),
              months: (monthsById.get(r.user_id) ?? []).sort((x, y) =>
                x.month.localeCompare(y.month),
              ),
            }
          })
          .sort(compareByDepartmentThenName)

        // Everyone with in-scope hours who is NOT on the active roster. Stated
        // on the page rather than silently dropped — the hours are real and
        // someone reconciling against the F2 grid's 62 rows deserves the
        // arithmetic.
        let hiddenCount = 0
        let hiddenHours = 0
        for (const [uid, a] of agg.entries()) {
          if (!onRoster.has(uid)) {
            hiddenCount++
            hiddenHours += a.hours
          }
        }

        setState({
          cards,
          floor: config.person_min_sample,
          hiddenCount,
          hiddenHours,
          month,
        })
        setError(undefined)
      } catch (e) {
        if (!cancelled) setError(describeError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const byDepartment = useMemo(() => {
    const groups = new Map<string, PersonCardData[]>()
    for (const c of state.cards) {
      const key = c.department_name ?? 'Unassigned'
      groups.set(key, [...(groups.get(key) ?? []), c])
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [state.cards])

  const atFloor = state.cards.filter(
    (c) => c.calibration?.meets_sample_floor && c.calibration.n >= state.floor,
  ).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">People</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-neutral-500">
            Who needs coaching, on what, and with what evidence. One card per person, grouped by
            department and ordered by name — there is no ranking here on purpose. Every figure
            carries its sample size, and anything measured on too little data is withheld rather
            than rounded into something that looks certain.
          </p>
        </div>
        <FreshnessStamp />
      </div>

      {error ? (
        <LoadFailure what="The People roster" error={error} />
      ) : loading ? (
        <Loading what="coaching cards" />
      ) : (
        <>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[11px] leading-relaxed text-neutral-600">
            <span className="font-medium text-neutral-800">{state.cards.length} people</span> on the
            active roster with hours on the 65 client-delivery projects, tasks created since
            2025-01-01. <span className="font-medium text-neutral-800">{atFloor}</span> of them have
            enough completed estimated work to show a calibration figure (n ≥ {state.floor}); for
            the rest the card says why not.{' '}
            {state.hiddenCount > 0 && (
              <>
                A further{' '}
                <span className="font-medium text-neutral-800">
                  {state.hiddenCount} people ({formatHours(state.hiddenHours)})
                </span>{' '}
                have in-scope hours but have left the company or are not on the PeopleForce roster,
                so they have no card — their contributions stay on the project pages. Duplicate
                accounts are merged, so one person is one card even when they logged under two ids.
              </>
            )}
          </div>

          {byDepartment.map(([dept, people]) => (
            <section key={dept} className="space-y-2.5">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold text-neutral-900">
                {dept}
                <span className="text-[11px] font-normal text-neutral-400">
                  {people.length} {people.length === 1 ? 'person' : 'people'}
                </span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {people.map((p) => (
                  <PersonCard key={p.user_id} d={p} floor={state.floor} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <div className="space-y-1.5 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-400">
        <p>
          A task counts toward someone&rsquo;s calibration only if they logged at least 40% of its
          hours. Assignee-of-record is display metadata and is never used for attribution: 59–63% of
          estimated tasks have several contributors, and on 18–36% of them the named assignee logged
          nothing at all. Tasks where the top two contributors tie exactly stay unattributed rather
          than being handed to whoever sorts first.
        </p>
        <p>
          Because of that rule, the per-person overrun and calibration figures do not sum to the
          company headline — the difference is the work §5 declines to charge to any individual. The
          exact-match share is shown beside in-band on every card that has both, never on its own.
        </p>
        <p>
          What this page cannot tell you: estimates carry no edit history, so a task re-estimated
          mid-flight looks identical to one estimated well; no field records who created a task
          without an estimate; and per-person returned-rate is not shown at all, because the
          canonical returned-rate view exists only at project grain today.
        </p>
      </div>
    </div>
  )
}
