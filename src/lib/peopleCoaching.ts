/**
 * §4.5 People — the policy and the framing, in one place.
 *
 * This module exists because the People page is the one surface that measures
 * individual colleagues on a tool management uses to evaluate them. Two rules
 * from the plan are load-bearing here and are enforced in code rather than
 * left to each component's good intentions:
 *
 *  1. **Suppress below the floor.** §4.5: "metrics suppress below floor-n
 *     rather than rendering misleading precision". The floor is §5's
 *     `person_min_sample`, read from `v_metric_config` — never a literal.
 *  2. **Questions, not verdicts.** §9: framing "stays behavioral (*timesheet
 *     mirrors estimate — is tracking real?*), never accusatory", and §2.5:
 *     "Coach, don't rank". Every string this module produces is phrased as
 *     something to ask a person, not something concluded about them.
 *
 * The reason (1) cannot be left to the view's own boolean: at today's data
 * `v_metric_calibration_by_person.exact_match_flagged` is **true for Ivan
 * Kotsan on n = 2**. §5 is explicit that such a person is "correctly
 * suppressed by the sample floor instead of published as a finding", so the
 * flag has to be read as `exact_match_flagged AND meets_sample_floor`.
 * `trustFlag()` is the only place that conjunction is written.
 */

import type { PersonCalibration } from '@/lib/queries'

/** §4.5 default ordering: "by department, then name." */
export function compareByDepartmentThenName(
  a: { department_name: string | null; display_name: string },
  b: { department_name: string | null; display_name: string },
): number {
  const da = a.department_name ?? 'Unassigned'
  const db = b.department_name ?? 'Unassigned'
  if (da !== db) return da.localeCompare(db)
  return a.display_name.localeCompare(b.display_name)
}

// ───────────────────────────────────────────────────────────────────────────
// Calibration display state
// ───────────────────────────────────────────────────────────────────────────

export type CalibrationState =
  /** No completed estimated task is attributed to this person at all. */
  | { kind: 'no-sample' }
  /** Has a sample, but under §5's floor — figures withheld on purpose. */
  | { kind: 'below-floor'; n: number; floor: number }
  /** At or above the floor: figures may be shown. */
  | { kind: 'shown'; c: PersonCalibration }

export function calibrationState(
  c: PersonCalibration | undefined,
  floor: number,
): CalibrationState {
  if (!c || c.n === 0) return { kind: 'no-sample' }
  // Trust the view's own boolean, but fall back to the config floor if a
  // future view revision stops emitting it.
  const meets = c.meets_sample_floor && c.n >= floor
  if (!meets) return { kind: 'below-floor', n: c.n, floor }
  return { kind: 'shown', c }
}

// ───────────────────────────────────────────────────────────────────────────
// The trust flag (§4.5 · §1.3 · §1.6 · §9)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Which conversation the mechanism evidence points at.
 *
 * §1.6 established that entries-per-task and distinct-dates-per-task are what
 * separate the two, and that they lead to *different* questions — which is why
 * §4.5 asks for the mechanism, "not just the exact-match share over time".
 *
 *  - `block-allocation` — Petrianyk's pattern: one whole-hour lump per task
 *    equal to the estimate, a whole history landing on a handful of month-end
 *    dates. The view's own COMMENT describes it as "~1 entry on ~1 date".
 *  - `granular` — Shchulo's pattern: multi-entry, multi-week, near real-time
 *    logging that nonetheless lands exactly on the estimate.
 *  - `mixed` — neither shape is clean enough to claim. We say so.
 */
export type Mechanism = 'block-allocation' | 'granular' | 'mixed'

export function readMechanism(
  entriesPerTask: number | null,
  datesPerTask: number | null,
): Mechanism {
  if (entriesPerTask == null || datesPerTask == null) return 'mixed'
  if (entriesPerTask <= 1.5 && datesPerTask <= 1.5) return 'block-allocation'
  if (entriesPerTask >= 3 && datesPerTask >= 2.5) return 'granular'
  return 'mixed'
}

export type TrustFlag = {
  /** §9's exact behavioural framing. Always a question. */
  headline: string
  /** What was observed — figures only, no interpretation. */
  observation: string
  /** What the mechanism evidence suggests, hedged to the evidence. */
  reading: string
  /** The question to put to the person. §1.3 supplies these verbatim. */
  question: string
  mechanism: Mechanism
}

/**
 * Returns a flag **only** when the view flags the person *and* they clear the
 * sample floor. Below the floor there is no flag and no exact-match figure —
 * not a quieter flag, none.
 */
export function trustFlag(
  c: PersonCalibration | undefined,
  floor: number,
): TrustFlag | null {
  if (!c) return null
  if (!c.exact_match_flagged) return null
  if (!c.meets_sample_floor || c.n < floor) return null

  const mechanism = readMechanism(c.avg_entries_per_task, c.avg_distinct_dates_per_task)
  const pct = c.exact_match_pct == null ? '—' : `${c.exact_match_pct.toFixed(1)}%`
  const entries = c.avg_entries_per_task?.toFixed(2) ?? '—'
  const dates = c.avg_distinct_dates_per_task?.toFixed(2) ?? '—'

  const observation =
    `On ${pct} of their ${c.n} attributed tasks the logged time landed within 1% of the ` +
    `estimate (team baseline is roughly 14–19%). Those tasks carry ${entries} time entries ` +
    `across ${dates} distinct dates on average.`

  // Each reading leads to a different conversation — that is the whole point
  // of showing the mechanism rather than the share alone (§4.5).
  const READINGS: Record<Mechanism, { reading: string; question: string }> = {
    'block-allocation': {
      reading:
        'That shape — roughly one entry on one date per task — is what month-end block ' +
        'allocation looks like: a lump booked to match the estimate rather than time ' +
        'measured as it was spent. It is not proof of one; some work genuinely is booked ' +
        'in a single sitting.',
      // §1.3, verbatim.
      question: 'Is this real tracking or monthly budget allocation, and who enters it?',
    },
    granular: {
      reading:
        'That shape argues against block allocation: the time is logged in many small ' +
        'entries spread over many days, which is what genuine near-real-time tracking ' +
        'looks like. The open question is what happens at the end — §1.6 found tasks ' +
        'where small final top-ups land the total exactly on the estimate.',
      // §1.3, verbatim.
      question:
        'When a task nears its estimate, do you trim the last worklogs to zero it out — ' +
        'and where do the real leftover hours go?',
    },
    mixed: {
      reading:
        'The logging shape sits between the two patterns §1.6 could tell apart, so the ' +
        'evidence here does not favour block allocation or fit-to-estimate logging. Worth ' +
        'looking at a few of the tasks directly before drawing any conclusion.',
      question:
        'How do you arrive at the final number on a task — is it measured as you go, or ' +
        'reconciled at the end?',
    },
  }

  return {
    // §9's phrasing, kept word-for-word.
    headline: 'Timesheet mirrors estimate — is tracking real?',
    observation,
    ...READINGS[mechanism],
    mechanism,
  }
}

/**
 * The standing caveat that renders with every flag. §1.3 is explicit that
 * without the mechanism evidence "the dashboard coaches the gaming, not the
 * estimating" — and §1.6 could not exclude edited estimates for anyone,
 * because estimates carry no edit history (R10 is the unit that would close
 * it).
 */
export const TRUST_FLAG_CAVEAT =
  'This is a prompt to investigate, not a finding. The dashboard cannot see estimate edit ' +
  'history, so a task re-estimated mid-flight is indistinguishable from one estimated well; ' +
  'and it cannot tell who entered a time record. Ask before concluding.'

// ───────────────────────────────────────────────────────────────────────────
// Quarterly calibration (person detail only — see the note in queries.ts)
// ───────────────────────────────────────────────────────────────────────────

export type Quarter = {
  key: string
  n: number
  median_ratio: number
  exact_match_pct: number
}

/** `2026-05-14T…` → `2026Q2`. */
export function quarterKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`
}

function median(sorted: number[]): number {
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Buckets an already-canonical sample into quarters.
 *
 * Only the bucketing happens here: `ratio` and `is_exact_match` arrive from
 * `v_metric_tasks`, so this cannot disagree with the all-time figures above it
 * about what a ratio is. §1.3: "Monthly per-person trends are statistical
 * noise; quarterly works."
 */
export function toQuarters(
  tasks: { completed_on: string | null; ratio: number; is_exact_match: boolean }[],
): Quarter[] {
  const buckets = new Map<string, { ratios: number[]; exact: number }>()
  for (const t of tasks) {
    if (!t.completed_on) continue
    const key = quarterKey(t.completed_on)
    const b = buckets.get(key) ?? { ratios: [], exact: 0 }
    b.ratios.push(t.ratio)
    if (t.is_exact_match) b.exact++
    buckets.set(key, b)
  }
  return Array.from(buckets.entries())
    .map(([key, b]) => {
      const sorted = [...b.ratios].sort((x, y) => x - y)
      return {
        key,
        n: sorted.length,
        median_ratio: median(sorted),
        exact_match_pct: (b.exact / sorted.length) * 100,
      }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * A **display** threshold, not a §5 metric threshold.
 *
 * Per-person quarterly samples run n = 1–22 at today's data — far below the
 * n ≥ 10 sample floor in most quarters. Rendering a 1-task quarter with the
 * same weight as a 22-task one is precisely the "misleading precision" §4.5
 * suppresses, so thin quarters render muted and carry their n. Deliberately
 * lower than the §5 floor: at the floor almost no quarter would ever render,
 * and the shape of a person's history is still worth seeing.
 */
export const QUARTER_DISPLAY_MIN = 5
