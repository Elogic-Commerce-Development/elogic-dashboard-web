import type { BlowoutTask, CalibrationTask } from './queries'

/**
 * The client-side *cuts* of the §5 calibration sample (plan §4.2).
 *
 * Nothing here decides whether a task is in the sample, in band, or an exact
 * match — `v_metric_tasks` already did, and §2.3 forbids re-deriving it. What
 * lives here is bucketing and summary arithmetic over rows the database
 * already classified, which is why every cut below reconciles to the same
 * totals: they are four views of one array.
 */

/** Continuous median, matching Postgres `PERCENTILE_CONT(0.5)`. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export type CalibrationSummary = {
  n: number
  median_ratio: number | null
  mean_ratio: number | null
  p90_ratio: number | null
  in_band_pct: number | null
  exact_match_pct: number | null
  /** §4.2's hero quantity: the share that finished at more than 2× estimate. */
  blew_2x_pct: number | null
  blew_2x: number
}

/** Continuous 90th percentile, matching `PERCENTILE_CONT(0.9)`. */
function p90(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const pos = 0.9 * (s.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

export function summarize(tasks: CalibrationTask[]): CalibrationSummary {
  const n = tasks.length
  if (n === 0) {
    return {
      n: 0,
      median_ratio: null,
      mean_ratio: null,
      p90_ratio: null,
      in_band_pct: null,
      exact_match_pct: null,
      blew_2x_pct: null,
      blew_2x: 0,
    }
  }
  const ratios = tasks.map((t) => t.ratio)
  const inBand = tasks.filter((t) => t.is_in_band).length
  const exact = tasks.filter((t) => t.is_exact_match).length
  const blew = tasks.filter((t) => t.ratio > 2).length
  return {
    n,
    median_ratio: median(ratios),
    mean_ratio: ratios.reduce((a, b) => a + b, 0) / n,
    p90_ratio: p90(ratios),
    in_band_pct: (inBand / n) * 100,
    exact_match_pct: (exact / n) * 100,
    blew_2x_pct: (blew / n) * 100,
    blew_2x: blew,
  }
}

/**
 * §4.2's histogram buckets — "never a lone mean: mean 1.54 vs median 1.00 is
 * the whole story".
 *
 * The in-band bucket is keyed off the view's own `is_in_band` flag rather than
 * a `>= 0.8 && <= 1.2` comparison, so the bar and the in-band % on the same
 * screen are the same number by construction, and a retune of
 * `v_metric_config.in_band_lo/hi` moves both together.
 */
export const RATIO_BUCKETS = ['<0.5', '0.5–0.8', '0.8–1.2', '1.2–2', '2–5', '>5'] as const
export type RatioBucket = (typeof RATIO_BUCKETS)[number]

export function ratioBucket(t: CalibrationTask): RatioBucket {
  if (t.is_in_band) return '0.8–1.2'
  if (t.ratio < 0.5) return '<0.5'
  if (t.ratio < 0.8) return '0.5–0.8'
  if (t.ratio <= 2) return '1.2–2'
  if (t.ratio <= 5) return '2–5'
  return '>5'
}

export type HistogramBin = {
  bucket: RatioBucket
  tasks: number
  share_pct: number
  /** Estimated and actual hours in the bin — the money behind the count. */
  estimate_hours: number
  actual_hours: number
}

export function histogram(tasks: CalibrationTask[]): HistogramBin[] {
  const byBucket = new Map<RatioBucket, HistogramBin>(
    RATIO_BUCKETS.map((bucket) => [
      bucket,
      { bucket, tasks: 0, share_pct: 0, estimate_hours: 0, actual_hours: 0 },
    ]),
  )
  for (const t of tasks) {
    const bin = byBucket.get(ratioBucket(t))
    if (!bin) continue
    bin.tasks += 1
    bin.estimate_hours += t.estimate_hours
    bin.actual_hours += t.actual_hours
  }
  const total = tasks.length || 1
  return RATIO_BUCKETS.map((b) => {
    const bin = byBucket.get(b)!
    return { ...bin, share_pct: (bin.tasks / total) * 100 }
  })
}

/**
 * §4.2's by-estimate-size cut ("≤2h runs 1.9×"). Sizes are the *estimate*, not
 * the actual — the question is whether small estimates are systematically
 * optimistic, and bucketing by actual would answer it circularly.
 */
export const SIZE_BUCKETS = ['≤ 2h', '2–8h', '8–20h', '> 20h'] as const
export type SizeBucket = (typeof SIZE_BUCKETS)[number]

export function sizeBucket(estimateHours: number): SizeBucket {
  if (estimateHours <= 2) return '≤ 2h'
  if (estimateHours <= 8) return '2–8h'
  if (estimateHours <= 20) return '8–20h'
  return '> 20h'
}

export type Cut<K extends string> = { key: K; summary: CalibrationSummary }

export function bySize(tasks: CalibrationTask[]): Cut<SizeBucket>[] {
  return SIZE_BUCKETS.map((key) => ({
    key,
    summary: summarize(tasks.filter((t) => sizeBucket(t.estimate_hours) === key)),
  }))
}

/**
 * §4.2's Jira-vs-AC benchmark line (48% vs 27% in-band). This is the one
 * cross-source comparison the plan asks for and it is deliberate: it is the
 * internal proof that the estimation process *can* work here, on the same
 * teams, when the tooling asks for an estimate. (§4.3's ban on cross-source
 * comparison is about QA coverage, where the two sources measure different
 * things.)
 */
export type SourceCut = { source: 'activecollab' | 'jira'; label: string; summary: CalibrationSummary }

export function bySource(tasks: CalibrationTask[]): SourceCut[] {
  return [
    {
      source: 'activecollab' as const,
      label: 'ActiveCollab',
      summary: summarize(tasks.filter((t) => t.source !== 'jira')),
    },
    {
      source: 'jira' as const,
      label: 'Jira (PSP)',
      summary: summarize(tasks.filter((t) => t.source === 'jira')),
    },
  ]
}

/** `2026-05-14` → `2026-Q2`. Completion date, because that is when the ratio settled. */
export function quarterOf(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7))
  return `${isoDate.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`
}

export type QuarterPoint = {
  quarter: string
  n: number
  in_band_pct: number | null
  exact_match_pct: number | null
  blew_2x_pct: number | null
}

/**
 * §4.2's quarterly calibration trend. Quarters with no completions are omitted
 * rather than plotted as zero: a quarter nobody completed anything in has no
 * in-band percentage, and drawing it at 0% would read as a collapse.
 */
export function byQuarter(tasks: CalibrationTask[]): QuarterPoint[] {
  const byQ = new Map<string, CalibrationTask[]>()
  for (const t of tasks) {
    if (!t.completed_on) continue
    const q = quarterOf(t.completed_on.slice(0, 10))
    const list = byQ.get(q)
    if (list) list.push(t)
    else byQ.set(q, [t])
  }
  return Array.from(byQ.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([quarter, list]) => {
      const s = summarize(list)
      return {
        quarter,
        n: s.n,
        in_band_pct: s.in_band_pct,
        exact_match_pct: s.exact_match_pct,
        blew_2x_pct: s.blew_2x_pct,
      }
    })
}

/**
 * Overrun concentration — §1.1's "top 10 tasks = 22% of overrun hours; top 30
 * = 42%", the fact that makes a ~30-row weekly review queue worth having.
 * Computed over the rows the table renders, so the claim is auditable on
 * screen.
 */
export function concentration(sortedHours: number[], topN: number): number | null {
  const total = sortedHours.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const top = sortedHours.slice(0, topN).reduce((a, b) => a + b, 0)
  return (top / total) * 100
}

export const SEGMENT_LABELS: Record<string, string> = {
  fixed_scope: 'Fixed scope',
  maintenance: 'Maintenance',
  tm_outstaff: 'T&M / outstaff',
  internal: 'Internal',
  unclassified: 'Unclassified',
}

export function segmentLabel(workModel: string): string {
  return SEGMENT_LABELS[workModel] ?? workModel
}

/** Coverage colour scale, shared by every coverage cell on the Estimation page. */
export function coverageTone(pct: number | null): string {
  if (pct == null) return 'text-neutral-400'
  if (pct >= 60) return 'text-emerald-600'
  if (pct >= 30) return 'text-amber-600'
  return 'text-red-600'
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

/** `1.52×`. Ratios read as multiples of the estimate, never as percentages. */
export function formatRatioX(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(2)}×`
}

/* ── Rollups that used to be database views ──────────────────────────────────
 *
 * `v_metric_calibration_by_project` and `v_metric_overrun_by_project` were the
 * page's first consumers, and each cost ~7.6s against production — they roll up
 * `v_metric_tasks` the same way `v_metric_{overrun,calibration}_by_person` did
 * before S6/R12 wrapped those in a MATERIALIZED CTE. The person views were
 * repaired because F2 needed them; these two were never consumed, so they were
 * never fixed, and eleven concurrent queries around them pushed this page's two
 * task-grain fetches past the API role's 8s statement timeout.
 *
 * Both are therefore rolled up here, from rows the page has already fetched.
 * Nothing is re-derived: `is_in_band` / `is_exact_match` / `ratio` /
 * `overrun_realized_hours` all still come from `v_metric_tasks`, and the
 * exact-match trust threshold is read from `v_metric_config` rather than
 * written down here. The gain beyond speed is that both tables now provably
 * reconcile with the rows rendered beside them.
 *
 * If a later backend session extends R12's treatment to the by_project views,
 * these can go back to being straight reads.
 * ─────────────────────────────────────────────────────────────────────────── */

export type ProjectCalibration = {
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  summary: CalibrationSummary
  exact_match_flagged: boolean
}

export function calibrationByProject(
  tasks: CalibrationTask[],
  exactMatchFlagPct: number,
): ProjectCalibration[] {
  const byProject = new Map<number, CalibrationTask[]>()
  for (const t of tasks) {
    const list = byProject.get(t.project_id)
    if (list) list.push(t)
    else byProject.set(t.project_id, [t])
  }
  return Array.from(byProject.values())
    .map((list) => {
      const summary = summarize(list)
      return {
        project_id: list[0].project_id,
        project_name: list[0].project_name,
        source: list[0].source,
        work_model: list[0].work_model,
        summary,
        exact_match_flagged: (summary.exact_match_pct ?? 0) > exactMatchFlagPct,
      }
    })
    .sort((a, b) => b.summary.n - a.summary.n || a.project_name.localeCompare(b.project_name))
}

export type ProjectOverrun = {
  project_id: number
  project_name: string
  source: string | null
  work_model: string
  rate_band: string | null
  realized_overrun_tasks: number
  realized_overrun_hours: number
}

export function overrunByProject(tasks: BlowoutTask[]): ProjectOverrun[] {
  const byProject = new Map<number, ProjectOverrun>()
  for (const t of tasks) {
    const acc = byProject.get(t.project_id)
    if (acc) {
      acc.realized_overrun_tasks += 1
      acc.realized_overrun_hours += t.overrun_hours
    } else {
      byProject.set(t.project_id, {
        project_id: t.project_id,
        project_name: t.project_name,
        source: t.source,
        work_model: t.work_model,
        rate_band: t.rate_band,
        realized_overrun_tasks: 1,
        realized_overrun_hours: t.overrun_hours,
      })
    }
  }
  return Array.from(byProject.values()).sort(
    (a, b) => b.realized_overrun_hours - a.realized_overrun_hours,
  )
}
