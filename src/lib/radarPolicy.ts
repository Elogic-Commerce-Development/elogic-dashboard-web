/**
 * §4.1's queue-depth policy, in one place.
 *
 * These are *presentation* thresholds — how many rows a daily-glance page may
 * open with, and when it should say out loud that the queue is beyond triage
 * capacity. They deliberately do NOT live in `v_metric_config` with the metric
 * thresholds (80% consumption, the 14-day window, 40h/4wk spinning, 15%
 * write-off): those decide whether a signal *fires* and retuning one changes
 * the numbers; these decide only how much of an already-computed list is
 * visible before the "+N more" chip, and changing one changes no metric.
 *
 * §4.1's retuning rule still applies to the metric thresholds: reviewed after
 * the first 4 weeks of live use and quarterly after, tightened "only when the
 * queue is chronically over-depth *and* the tail rows are genuinely low-stakes;
 * never tuned to make the page look calm".
 */

/** "each list renders its top 15 … with an explicit overflow chip" (§4.1). */
export const QUEUE_TOP_N = 15

/** "Healthy is a total queue ≤ ~25 and flat-or-shrinking week over week" (§4.1). */
export const QUEUE_HEALTHY_MAX = 25

/**
 * "a queue that stays above ~40 for two consecutive weeks means triage
 * capacity, not thresholds, is the problem, and Radar says so in words" (§4.1).
 */
export const QUEUE_OVER_CAPACITY = 40

export type QueueDepthBand = 'healthy' | 'watch' | 'over_capacity'

/**
 * Depth is counted over the **bleeding-now task inventory** — the two live
 * lists together. That is the population §4.1's own parenthetical measures
 * ("today's pinned inventory is 29 recently-active + 70 approaching", i.e. the
 * ~100 rows the policy exists to stop the page opening with). The attention
 * queue above it is a per-project roll-up of the same work and would double
 * count. Flagged in docs/progress-log.md for the owner to confirm.
 */
export function queueDepthBand(depth: number): QueueDepthBand {
  if (depth <= QUEUE_HEALTHY_MAX) return 'healthy'
  if (depth <= QUEUE_OVER_CAPACITY) return 'watch'
  return 'over_capacity'
}
