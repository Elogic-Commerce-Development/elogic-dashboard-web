import { useEffect, useState } from 'react'
import { FreshnessStamp } from '@/components/radar/FreshnessStamp'
import { CoverageBlock, type CoverageData } from '@/components/estimation/CoverageBlock'
import { CalibrationBlock, type CalibrationData } from '@/components/estimation/CalibrationBlock'
import { OverrunBlock, type OverrunData } from '@/components/estimation/OverrunBlock'
import { describeError } from '@/lib/errors'
import {
  fetchCalibrationSample,
  fetchCoverageBySegment,
  fetchCoverageByProject,
  fetchCoverageTrend,
  fetchMetricConfig,
  fetchRealizedOverrunByPerson,
  fetchRealizedOverrunTasks,
  fetchUnassignedBucket,
  fetchUnestimatedByPerson,
  fetchZeroTracked,
} from '@/lib/queries'

type BlockKey = 'coverage' | 'calibration' | 'overrun'

const EMPTY_COVERAGE: CoverageData = {
  segments: [],
  trend: [],
  projects: [],
  people: [],
  unassigned: null,
}
const EMPTY_CALIBRATION: CalibrationData = { sample: [], zeroTracked: null, exactMatchFlagPct: 40 }
const EMPTY_OVERRUN: OverrunData = { people: [], tasks: [] }

/**
 * Estimation (plan §4.2) — "Is our work priced, and are the prices right?"
 *
 * Three blocks in the order the plan argues for: **coverage first**, because
 * the finding that reorganised this dashboard is that unpriced work
 * (25,000-plus hours) dwarfs mispriced work (~1,900h of settled overrun);
 * calibration second; the economics of the misprices last, as a review queue
 * somebody can actually work through.
 *
 * **No period switcher.** Every figure here is the all-time canonical value
 * over the 2025-01-01 task floor — the grain the §5 views and
 * `docs/parity-report.md` are defined at — and the two trends each own their
 * window (calendar months for coverage, quarters for calibration). Offering a
 * period control would mean summing month-grained views whose task counters
 * are distinct per month, which double-counts every task worked across a
 * boundary; F2 measured that at +30%/+56% and narrowed the grids for the same
 * reason. Radar made the same call for the same kind of reason.
 *
 * **Scope: `fixed_scope` + `maintenance` only**, stated on the page. T&M and
 * internal work carries no estimates by design, and blending it in would
 * manufacture a coverage problem that is really a business-model difference.
 *
 * ── Load shape (this is load-bearing, not tidiness) ─────────────────────────
 *
 * The blocks load in **waves**, and each renders as its wave lands. The first
 * deployed build fired all eleven queries at once and the two task-grain
 * fetches came back `57014 canceling statement due to statement timeout` — the
 * `authenticated` role's 8s cap. Radar is the control: it fires thirteen
 * concurrent queries and none exceeds 4.1s. The difference is that this page
 * was the first consumer of the `*_by_project` / `*_by_segment` rollups, which
 * cost ~7.6s each because S6/R12 only wrapped the *person* variants in a
 * MATERIALIZED CTE. Two of those rollups are now computed from rows already on
 * the page (see `lib/estimation.ts`), and what remains is staged so the heavy
 * task-grain fetches never run alongside each other.
 *
 * Failures stay per block (F3's lesson): a page whose query died must never
 * render "0h unestimated", which here would be the best news the company has
 * ever had.
 */
export function EstimationPage() {
  const [coverage, setCoverage] = useState<CoverageData>(EMPTY_COVERAGE)
  const [calibration, setCalibration] = useState<CalibrationData>(EMPTY_CALIBRATION)
  const [overrun, setOverrun] = useState<OverrunData>(EMPTY_OVERRUN)
  const [pending, setPending] = useState<Record<BlockKey, boolean>>({
    coverage: true,
    calibration: true,
    overrun: true,
  })
  const [failed, setFailed] = useState<Partial<Record<BlockKey, string>>>({})

  useEffect(() => {
    let cancelled = false

    const fail = (key: BlockKey, reason: unknown) => {
      if (!cancelled) setFailed((f) => ({ ...f, [key]: describeError(reason) }))
    }
    const done = (key: BlockKey) => {
      if (!cancelled) setPending((p) => ({ ...p, [key]: false }))
    }

    async function load() {
      // ── Wave 1: the pre-aggregated coverage views. ────────────────────────
      const [segments, trend, projects, people] = await Promise.allSettled([
        fetchCoverageBySegment(),
        fetchCoverageTrend(),
        fetchCoverageByProject(),
        fetchUnestimatedByPerson(),
      ])
      if (cancelled) return
      const coverageFailure = [segments, trend, projects, people].find((r) => r.status === 'rejected')
      if (coverageFailure && coverageFailure.status === 'rejected') fail('coverage', coverageFailure.reason)
      setCoverage({
        segments: segments.status === 'fulfilled' ? segments.value : [],
        trend: trend.status === 'fulfilled' ? trend.value : [],
        projects: projects.status === 'fulfilled' ? projects.value : [],
        people: people.status === 'fulfilled' ? people.value : [],
        unassigned: null,
      })
      done('coverage')

      // ── Wave 2: the calibration sample (task grain, alone) + two cheap reads.
      const [sample, zeroTracked, config] = await Promise.allSettled([
        fetchCalibrationSample(),
        fetchZeroTracked(),
        fetchMetricConfig(),
      ])
      if (cancelled) return
      if (sample.status === 'rejected') fail('calibration', sample.reason)
      setCalibration({
        sample: sample.status === 'fulfilled' ? sample.value : [],
        zeroTracked: zeroTracked.status === 'fulfilled' ? zeroTracked.value : null,
        // The threshold has a canonical default in the view; falling back to it
        // only affects whether a "flag" pill renders, never a number.
        exactMatchFlagPct: config.status === 'fulfilled' ? config.value.exact_match_flag_pct : 40,
      })
      done('calibration')

      // ── Wave 3: the realized-overrun tasks (task grain, alone) + the person
      //    rollup, which is one of the two R12 already made fast.
      const [tasks, overrunPeople] = await Promise.allSettled([
        fetchRealizedOverrunTasks(),
        fetchRealizedOverrunByPerson(),
      ])
      if (cancelled) return
      const overrunFailure = [tasks, overrunPeople].find((r) => r.status === 'rejected')
      if (overrunFailure && overrunFailure.status === 'rejected') fail('overrun', overrunFailure.reason)
      setOverrun({
        tasks: tasks.status === 'fulfilled' ? tasks.value : [],
        people: overrunPeople.status === 'fulfilled' ? overrunPeople.value : [],
      })
      done('overrun')

      // ── Wave 4: the Unassigned tally. Last on purpose — it is one line of
      //    the coverage block, so it is the one query allowed to keep the
      //    reader waiting, and its absence degrades a row rather than a block.
      try {
        const unassigned = await fetchUnassignedBucket()
        if (!cancelled) setCoverage((c) => ({ ...c, unassigned }))
      } catch {
        // Renders as "not measured" — never as zero unassigned tasks.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Estimation</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-neutral-500">
            Is our work priced, and are the prices right? Fixed-scope and maintenance projects only —
            T&amp;M and internal work has no estimates by design and is excluded rather than averaged
            in. Tasks created since 2025-01-01.
          </p>
        </div>
        <FreshnessStamp />
      </div>

      <CoverageBlock data={coverage} loading={pending.coverage} error={failed.coverage} />
      <CalibrationBlock data={calibration} loading={pending.calibration} error={failed.calibration} />
      <OverrunBlock data={overrun} loading={pending.overrun} error={failed.overrun} />

      <div className="space-y-1.5 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-400">
        <p>
          Every figure reads a canonical <code>v_metric_*</code> view; no threshold or predicate is
          computed in the browser. Ratios are actual ÷ estimate on completed tasks with both sides
          above zero; the in-band window (0.8–1.2) and the exact-match trust threshold live in{' '}
          <code>v_metric_config</code> on the database, and this page reads that row rather than
          writing the numbers down.
        </p>
        <p>
          Per-project and per-person rows are rounded to one decimal before they are summed, so a
          column total can differ from the headline by tenths of an hour (0.0003% at current
          volumes). Person-level overrun reads the in-scope canonical view: the segments excluded
          from this page hold no estimated tasks, so they contribute no overrun to filter out.
        </p>
        <p>
          What this page cannot tell you: estimates carry no edit history, so a task that was
          re-estimated mid-flight is indistinguishable from one estimated well; and no field records
          who created a task without an estimate.
        </p>
      </div>
    </div>
  )
}
