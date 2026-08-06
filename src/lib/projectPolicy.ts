/**
 * Display policy for the Projects surfaces (F6) — the same split F3 wrote into
 * `radarPolicy.ts`: anything that decides whether a metric *fires* lives in
 * `v_metric_config` on the database; anything that only decides how the pages
 * *present* already-computed data lives here, because changing it moves no
 * number.
 */

/**
 * §4.6's "count > 180 days old" backlog-hygiene column — the age bucket for an
 * open task to count as old. Display bucketing of raw `created_on` dates, not
 * a firing threshold.
 */
export const BACKLOG_OLD_DAYS = 180

/**
 * When the old-open share reaches this fraction, the backlog cell renders
 * amber — §4.6's zombie-backlog reading (Armacell: 359 of 384 open tasks over
 * a year old) made visible without a new metric.
 */
export const ZOMBIE_BACKLOG_SHARE = 0.5

/**
 * Top-contributor share at which the bus-factor figure renders amber — one
 * person carrying three quarters of a project is worth a glance. Emphasis
 * only; the share itself always renders.
 */
export const BUS_FACTOR_WARN_PCT = 75
