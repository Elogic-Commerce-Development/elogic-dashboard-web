/**
 * §4.4's display policy, in one place.
 *
 * Same split as `radarPolicy.ts` / `projectPolicy.ts` / `qualityPolicy.ts`:
 * presentation only. The one threshold on this page that *fires* something —
 * the > 15% per-project flag — is not here, because it is not ours to decide:
 * it lives in `v_metric_config.writeoff_alert_pct` and arrives pre-computed as
 * `v_metric_writeoff_by_project.writeoff_flagged`. The page renders the view's
 * boolean and never recomputes it.
 */

/**
 * §4.4's monthly alert line: "Monthly write-off % vs baseline and a **10%
 * alert line**".
 *
 * This is a different number from the 15% per-project flag and deliberately
 * so — a portfolio-wide month at 10% is a drift signal, while a single project
 * at 10% is ordinary. It has no home in `v_metric_config` because no view
 * fires on it; it is a line drawn on a chart, which is exactly what this
 * module is for.
 */
export const MONTHLY_ALERT_PCT = 10

/**
 * §5's pinned baseline: "Write-off % … Baseline ~8.8% (since-2025
 * denominator)". §1.6 pins it as 8.8% and records that the 8.4% figure
 * floating around discovery is not reproducible under any nearby predicate
 * (the all-time denominator computes 9.0%).
 *
 * The page draws the baseline from the **live** all-time views rather than
 * from this constant — a hard-coded baseline would silently stop matching the
 * data. This is here only so the page can say what the pin was and show
 * whether today still agrees with it.
 */
export const PINNED_BASELINE_PCT = 8.8

/**
 * A month whose last day has not happened yet is not comparable to a closed
 * month: the current partial month reads 42.8% on 114h at the time of writing,
 * purely because a few days of non-billable admin landed before the billable
 * delivery hours did. §4.4's chart is a drift signal, and a partial month
 * plotted like a closed one manufactures drift.
 *
 * The series therefore marks the in-progress month rather than dropping it —
 * dropping data is its own kind of lie, and "month in progress" is a caption a
 * reader can act on.
 */
export function isPartialMonth(monthIso: string, today: Date = new Date()): boolean {
  const currentMonthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  )
  return monthIso >= currentMonthStart.toISOString().slice(0, 10)
}

export type WriteoffTone = 'emerald' | 'amber' | 'red' | 'neutral'

/**
 * Monthly tone, against the two lines the chart already draws: at or under the
 * §5 baseline is normal, between baseline and the 10% alert line is drift,
 * above the alert line is the thing §4.4 exists to surface.
 */
export function monthlyWriteoffTone(pct: number | null, baselinePct: number): WriteoffTone {
  if (pct == null) return 'neutral'
  if (pct >= MONTHLY_ALERT_PCT) return 'red'
  if (pct > baselinePct) return 'amber'
  return 'emerald'
}

/** How many ledger rows open before "Show all". */
export const LEDGER_TOP_N = 15

/**
 * §4.4: "cost-of-sale (Pre-sales, 976h/22 people) split out from write-offs —
 * different phenomenon, different judgment".
 *
 * The split is by **work model**, not by project name. `work_model =
 * 'internal'` is the S2/S2b classification for company-run work — pre-sales,
 * BA activities, internal PM, QA process — none of which is a client engagement
 * whose hours we failed to bill. Rolling them into the delivery write-off rate
 * is precisely the conflation §4.4 warns against, and using the tag rather
 * than a name match means a newly-created internal project is classified by
 * the owner's own S2b pass instead of by a string we guessed.
 */
export const COST_OF_SALE_WORK_MODEL = 'internal'

/**
 * The delivery segments a write-off rate is a judgment about. Everything else
 * is reported beside them, never blended in.
 */
export const DELIVERY_WORK_MODELS = ['fixed_scope', 'maintenance', 'tm_outstaff'] as const

export const WORK_MODEL_LABELS: Record<string, string> = {
  fixed_scope: 'Fixed scope',
  maintenance: 'Maintenance',
  tm_outstaff: 'T&M / outstaff',
  internal: 'Internal',
  unclassified: 'Unclassified',
}

export function workModelLabel(workModel: string | null): string {
  if (!workModel) return 'Unclassified'
  return WORK_MODEL_LABELS[workModel] ?? workModel
}
