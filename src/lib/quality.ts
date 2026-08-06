/**
 * §4.3's cuts of the QA-covered completed-task sample, and the formatters that
 * go with them — the Quality-page sibling of `lib/estimation.ts`.
 *
 * Everything here is **aggregation over rows a canonical view already
 * classified**: `qa_iterations`, `is_completed`, `is_estimated` and
 * `overrun_hours` all arrive decided from `v_scope_tasks`, and nothing below
 * re-derives a §5 predicate (§2.3). The one figure that could look derived —
 * the returned rate — is cross-checked on the page against
 * `v_metric_returned_rate_by_project`, which computes it in SQL.
 */

import type { CompletedTaskCoverage, QaCompletedTask, ReturnedRateRow } from './queries'
import { enumerateMonths, TRACKING_FLOOR } from './period'
import { ITERATION_BUCKETS, type IterationBucket, iterationBucketLabel } from './qualityPolicy'

/** One rung of §4.3's rework cost ladder. */
export type LadderRung = {
  bucket: IterationBucket
  label: string
  tasks: number
  avg_actual_hours: number | null
  total_actual_hours: number
  estimated_tasks: number
  overrun_tasks: number
  /**
   * Overrun rate is a share of **estimated** tasks, not of all tasks in the
   * rung. An unestimated task cannot overrun by definition (§5 computes
   * overrun as `max(actual − estimate, 0)` over estimated tasks), so putting
   * unestimated work in the denominator would quietly report "less overrun" on
   * exactly the projects with the worst estimation coverage.
   */
  overrun_rate_pct: number | null
}

/**
 * §4.3: "avg actual hours and overrun rate by iteration count … frames returns
 * as hours, not counts".
 *
 * The third rung is 3+ rather than 3 because that is the grain the canonical
 * per-project view publishes (`avg_hours_iter_3plus`), so the portfolio ladder
 * and the per-project ladder stay comparable.
 */
export function buildReworkLadder(tasks: QaCompletedTask[]): LadderRung[] {
  return ITERATION_BUCKETS.map((bucket) => {
    const inBucket = tasks.filter((t) =>
      bucket === 3 ? t.qa_iterations >= 3 : t.qa_iterations === bucket,
    )
    const estimated = inBucket.filter((t) => t.is_estimated)
    const overrun = estimated.filter((t) => t.overrun_hours > 0)
    const totalHours = inBucket.reduce((sum, t) => sum + t.actual_hours, 0)
    return {
      bucket,
      label: iterationBucketLabel(bucket),
      tasks: inBucket.length,
      avg_actual_hours: inBucket.length > 0 ? totalHours / inBucket.length : null,
      total_actual_hours: totalHours,
      estimated_tasks: estimated.length,
      overrun_tasks: overrun.length,
      overrun_rate_pct:
        estimated.length > 0 ? (overrun.length / estimated.length) * 100 : null,
    }
  })
}

/** One month of §4.3's returned-rate trend. */
export type QualityMonth = {
  month: string
  /** Every in-scope task completed that month — the coverage denominator. */
  completed_tasks: number
  qa_covered_tasks: number
  /** §5: "Coverage % always shown". Null when nothing completed at all. */
  coverage_pct: number | null
  returned_tasks: number
  returned_pct: number | null
  avg_actual_hours: number | null
}

/**
 * §5's returned rate — "share of QA-covered completed tasks with
 * `qa_iterations >= 2`" — resolved per calendar month of `completed_on`.
 *
 * Completion month rather than creation month: the metric is about what QA
 * sent back, and a task created in January but returned twice in June is a
 * June quality event. It is also the grain `v_dashboard_quality_monthly` used
 * before the redesign, so the shape of the series is comparable even though
 * its population is not (that view is whole-company back to 2017).
 *
 * **The axis runs from the tracking floor, not from the first labelled task.**
 * Emitting only the months that have QA-covered completions would silently
 * close the gap where nobody recorded an iteration at all — and on this data
 * that gap is eight consecutive months (Jan–Aug 2025) during which hundreds of
 * tasks completed with zero coverage. On a page whose whole argument is that
 * coverage is the number to manage, compressing that period out of the chart
 * would hide the most important thing in it. Empty months are therefore
 * emitted explicitly with `qa_covered_tasks: 0` and a **null** rate — never a
 * zero rate, which would claim nothing was returned when the truth is that
 * nothing was measured.
 *
 * `completed_on` is a `timestamptz`; PostgREST serialises it as an ISO-8601
 * UTC string, so slicing the first seven characters buckets by UTC month.
 * Verified against the DB: 0 of 706 tasks bucket differently under UTC vs the
 * session timezone.
 */
export function buildQualityTrend(
  tasks: QaCompletedTask[],
  completed: CompletedTaskCoverage[] = [],
  floor = TRACKING_FLOOR,
  today: Date = new Date(),
): QualityMonth[] {
  const byMonth = new Map<string, QaCompletedTask[]>()
  for (const t of tasks) {
    if (!t.completed_on) continue
    const key = t.completed_on.slice(0, 7) + '-01'
    const bucket = byMonth.get(key)
    if (bucket) bucket.push(t)
    else byMonth.set(key, [t])
  }
  // The coverage denominator: every completed task, labelled or not.
  const completedByMonth = new Map<string, number>()
  for (const c of completed) {
    if (!c.completed_on) continue
    const key = c.completed_on.slice(0, 7) + '-01'
    completedByMonth.set(key, (completedByMonth.get(key) ?? 0) + 1)
  }
  if (byMonth.size === 0 && completedByMonth.size === 0) return []

  // Run the axis from the tracking floor to the later of the current month and
  // the last month carrying data, so a month with no coverage is a visible gap
  // rather than a missing bar.
  const allKeys = [...byMonth.keys(), ...completedByMonth.keys()].sort()
  const latestWithData = allKeys.at(-1) as string
  const currentMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`
  const to = latestWithData > currentMonth ? latestWithData : currentMonth

  return enumerateMonths({ from: floor, to }).map((month) => {
    const rows = byMonth.get(month) ?? []
    const completedCount = completedByMonth.get(month) ?? 0
    const returned = rows.filter((t) => t.qa_iterations >= 2).length
    const hours = rows.reduce((sum, t) => sum + t.actual_hours, 0)
    return {
      month,
      completed_tasks: completedCount,
      qa_covered_tasks: rows.length,
      coverage_pct: completedCount > 0 ? (rows.length / completedCount) * 100 : null,
      returned_tasks: returned,
      returned_pct: rows.length > 0 ? (returned / rows.length) * 100 : null,
      avg_actual_hours: rows.length > 0 ? hours / rows.length : null,
    }
  })
}

/** Portfolio totals for §4.3's headline tiles. */
export type QualitySummary = {
  qa_covered_tasks: number
  returned_tasks: number
  returned_pct: number | null
  completed_tasks: number
  qa_coverage_pct: number | null
  capped_tasks: number
  tasks_with_bug_counts: number
}

/**
 * The headline numbers, folded from both sources at once: the coverage
 * denominator (all completed tasks) only exists on the per-project rollup,
 * while the numerator detail lives on the task grain.
 */
export function summariseQuality(
  tasks: QaCompletedTask[],
  projects: ReturnedRateRow[],
): QualitySummary {
  const completed = projects.reduce((sum, p) => sum + p.completed_tasks, 0)
  const covered = tasks.length
  const returned = tasks.filter((t) => t.qa_iterations >= 2).length
  return {
    qa_covered_tasks: covered,
    returned_tasks: returned,
    returned_pct: covered > 0 ? (returned / covered) * 100 : null,
    completed_tasks: completed,
    qa_coverage_pct: completed > 0 ? (covered / completed) * 100 : null,
    capped_tasks: tasks.filter((t) => t.qa_iterations_capped).length,
    tasks_with_bug_counts: tasks.filter((t) => t.qa_bugs != null).length,
  }
}

/**
 * §4.3: "no cross-source comparisons anywhere".
 *
 * This cut carries **coverage only, never the returned rate** — deliberately,
 * and the omission is the rule being enforced. Coverage is a fact about
 * process (Jira derives iterations from the changelog; ActiveCollab needs
 * someone to apply a label) and §4.3 asks for it to be managed per source.
 * A returned rate beside it would be read as a quality comparison, and the two
 * rates are computed over populations that differ by a factor of eighteen —
 * 117 labelled AC completions against 589 Jira ones. Adversarial review caught
 * the first cut of this page rendering both rates side by side under a caption
 * insisting it was not a comparison; the caption was not what needed fixing.
 */
export type SourceCoverage = {
  source: 'activecollab' | 'jira'
  label: string
  completed_tasks: number
  qa_covered_tasks: number
  qa_coverage_pct: number | null
}

export function coverageBySource(projects: ReturnedRateRow[]): SourceCoverage[] {
  const cuts: Array<{ source: 'activecollab' | 'jira'; label: string }> = [
    { source: 'activecollab', label: 'ActiveCollab' },
    { source: 'jira', label: 'Jira (PSP)' },
  ]
  return cuts.map(({ source, label }) => {
    const rows = projects.filter((p) => (p.source ?? 'activecollab') === source)
    const completed = rows.reduce((s, p) => s + p.completed_tasks, 0)
    const covered = rows.reduce((s, p) => s + p.qa_covered_tasks, 0)
    return {
      source,
      label,
      completed_tasks: completed,
      qa_covered_tasks: covered,
      qa_coverage_pct: completed > 0 ? (covered / completed) * 100 : null,
    }
  })
}

/** `28.7` → `'28.7%'`, `null` → `'—'`. */
export function formatPct(v: number | null, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v.toFixed(digits)}%`
}
