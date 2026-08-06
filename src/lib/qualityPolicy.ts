/**
 * §4.3's display policy, in one place.
 *
 * Same split `radarPolicy.ts` and `projectPolicy.ts` establish: these are
 * *presentation* thresholds — which colour a rate wears, how many rows open
 * before a "show all", where an axis stops. They deliberately do NOT live in
 * `v_metric_config`, because nothing here changes a number. The one genuinely
 * metric-side constant on this page — the n ≥ 10 suppression floor — is read
 * from `v_metric_config.person_min_sample` via `fetchMetricConfig`, exactly as
 * §4.5's coaching cards do.
 *
 * Before F7 these literals were duplicated inline across `QaRate.tsx`,
 * `PersonQualityCards.tsx` and the (now deleted) `QualitySignalsSection.tsx`.
 * Three copies of "amber above 1" is how a threshold quietly becomes two
 * thresholds, so F7 extracted them here on its way past.
 */

/**
 * The upstream cap convention, from `docs/METRICS.md` §11: anything ≥ 5
 * iterations stores as `qa_iterations = 5, qa_iterations_capped = true`, and
 * anything ≥ 10 bugs stores as `qa_bugs = 10, qa_bugs_capped = true`.
 *
 * §4.3 is explicit that this must be visible rather than implied — "iterations
 * axes say 5+ (capped)". `formatQa()` in `lib/format.ts` renders the `+`
 * suffix; these are the axis bounds that go with it.
 */
export const QA_ITERATIONS_CAP = 5
export const QA_BUGS_CAP = 10

export const CAP_NOTE =
  'Capped upstream: 5+ QA iterations store as 5, 10+ bugs store as 10. ' +
  'Axes and averages therefore understate the worst tickets rather than overstate them.'

/**
 * §4.3's rework ladder buckets. The third is "3+" rather than 3 because the
 * backing column is `avg_hours_iter_3plus` — the view already folded the tail,
 * and re-splitting it client-side would need the task grain the ladder is
 * meant to summarise.
 */
export const ITERATION_BUCKETS = [1, 2, 3] as const
export type IterationBucket = (typeof ITERATION_BUCKETS)[number]

export function iterationBucketLabel(bucket: IterationBucket): string {
  return bucket === 3 ? '3+' : String(bucket)
}

/**
 * Returned-rate tone. §5 defines the metric as the share of QA-covered
 * completed tasks sent back for a 2nd+ round; there is no company target in
 * the plan, so these bands are read off the shipped distribution (portfolio
 * sits at ~29%) rather than invented: at or under a quarter is the better half
 * of the portfolio, over half is the tail worth a conversation.
 *
 * Deliberately *not* red-by-default: a high returned rate on a project with
 * real QA coverage is a working QA process finding things, which §4.3 frames
 * as the point of the page ("BUFF … is the internal proof it's doable").
 */
export const RETURNED_RATE_GOOD_MAX = 25
export const RETURNED_RATE_WARN_MAX = 50

export type QaTone = 'emerald' | 'amber' | 'red' | 'neutral'

export function returnedRateTone(pct: number | null): QaTone {
  if (pct == null) return 'neutral'
  if (pct <= RETURNED_RATE_GOOD_MAX) return 'emerald'
  if (pct <= RETURNED_RATE_WARN_MAX) return 'amber'
  return 'red'
}

/**
 * §4.3's coverage scoreboard exists to make the blind spot itself a managed
 * number: AC sits at ~4.7% QA coverage, Jira at ~86.5%. These bands are the
 * scoreboard's colouring — and the reason the page never compares a returned
 * rate across the two sources (§4.3: "no cross-source comparisons anywhere").
 */
export const QA_COVERAGE_GOOD_MIN = 50
export const QA_COVERAGE_WARN_MIN = 20

export function qaCoverageTone(pct: number | null): QaTone {
  if (pct == null) return 'neutral'
  if (pct >= QA_COVERAGE_GOOD_MIN) return 'emerald'
  if (pct >= QA_COVERAGE_WARN_MIN) return 'amber'
  return 'red'
}

/**
 * A returned rate computed over a handful of QA-covered tasks is noise. §4.5
 * suppresses person figures below n = 10 and §4.3 asks for the same treatment
 * ("Returned-rate (iterations ≥ 2) by project **with n**"), so the scoreboard
 * shows the row but withholds the percentage below the floor. The floor
 * itself comes from `v_metric_config.person_min_sample` at runtime; this is
 * only the fallback for a failed config read.
 */
export const RETURNED_RATE_MIN_SAMPLE_FALLBACK = 10

/** How many rows each §4.3 table opens with before "Show all". */
export const QUALITY_TABLE_TOP_N = 15

/**
 * §4.3: 'qa_bugs: "collecting since 2026-07-08" placeholder'. The date is the
 * day the PSP team's numeric "QA bugs" custom field started mapping into
 * `tasks.qa_bugs` (workspace CLAUDE.md, "What's DONE"). It is a provenance
 * fact about the column, not a metric, so it is page copy rather than a view.
 */
export const QA_BUGS_COLLECTING_SINCE = '2026-07-08'
