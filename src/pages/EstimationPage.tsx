import { useEffect, useState } from 'react'
import { FreshnessStamp } from '@/components/radar/FreshnessStamp'
import { CoverageBlock, type CoverageData } from '@/components/estimation/CoverageBlock'
import { CalibrationBlock, type CalibrationData } from '@/components/estimation/CalibrationBlock'
import { OverrunBlock, type OverrunData } from '@/components/estimation/OverrunBlock'
import { describeError } from '@/lib/errors'
import {
  fetchCalibrationByProject,
  fetchCalibrationSample,
  fetchCoverageBySegment,
  fetchCoverageByProject,
  fetchCoverageTrend,
  fetchRealizedOverrunByPerson,
  fetchRealizedOverrunByProject,
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
const EMPTY_CALIBRATION: CalibrationData = { sample: [], projects: [], zeroTracked: null }
const EMPTY_OVERRUN: OverrunData = { projects: [], people: [], tasks: [] }

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
 * Failures are per block (F3's lesson): a page whose query died must never
 * render "0h unestimated", which here would be the best news the company has
 * ever had.
 */
export function EstimationPage() {
  const [coverage, setCoverage] = useState<CoverageData>(EMPTY_COVERAGE)
  const [calibration, setCalibration] = useState<CalibrationData>(EMPTY_CALIBRATION)
  const [overrun, setOverrun] = useState<OverrunData>(EMPTY_OVERRUN)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState<Partial<Record<BlockKey, string>>>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [
        segments,
        trend,
        coverageProjects,
        people,
        unassigned,
        sample,
        calibrationProjects,
        zeroTracked,
        overrunProjects,
        overrunPeople,
        overrunTasks,
      ] = await Promise.allSettled([
        fetchCoverageBySegment(),
        fetchCoverageTrend(),
        fetchCoverageByProject(),
        fetchUnestimatedByPerson(),
        fetchUnassignedBucket(),
        fetchCalibrationSample(),
        fetchCalibrationByProject(),
        fetchZeroTracked(),
        fetchRealizedOverrunByProject(),
        fetchRealizedOverrunByPerson(),
        fetchRealizedOverrunTasks(),
      ])
      if (cancelled) return

      const problems: Partial<Record<BlockKey, string>> = {}
      // The first rejection in a block names the block's failure. Anything
      // whose absence only degrades a row (the unassigned tally, the
      // zero-tracked count) is nulled instead, so one soft query cannot black
      // out a block that has real numbers to show.
      const firstError = (key: BlockKey, results: PromiseSettledResult<unknown>[]) => {
        const bad = results.find((r) => r.status === 'rejected')
        if (bad && bad.status === 'rejected') problems[key] = describeError(bad.reason)
      }

      firstError('coverage', [segments, trend, coverageProjects, people])
      firstError('calibration', [sample, calibrationProjects])
      firstError('overrun', [overrunProjects, overrunPeople, overrunTasks])

      setCoverage({
        segments: segments.status === 'fulfilled' ? segments.value : [],
        trend: trend.status === 'fulfilled' ? trend.value : [],
        projects: coverageProjects.status === 'fulfilled' ? coverageProjects.value : [],
        people: people.status === 'fulfilled' ? people.value : [],
        unassigned: unassigned.status === 'fulfilled' ? unassigned.value : null,
      })
      setCalibration({
        sample: sample.status === 'fulfilled' ? sample.value : [],
        projects: calibrationProjects.status === 'fulfilled' ? calibrationProjects.value : [],
        zeroTracked: zeroTracked.status === 'fulfilled' ? zeroTracked.value : null,
      })
      setOverrun({
        projects: overrunProjects.status === 'fulfilled' ? overrunProjects.value : [],
        people: overrunPeople.status === 'fulfilled' ? overrunPeople.value : [],
        tasks: overrunTasks.status === 'fulfilled' ? overrunTasks.value : [],
      })

      setFailed(problems)
      setLoading(false)
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

      <CoverageBlock data={coverage} loading={loading} error={failed.coverage} />
      <CalibrationBlock data={calibration} loading={loading} error={failed.calibration} />
      <OverrunBlock data={overrun} loading={loading} error={failed.overrun} />

      <div className="space-y-1.5 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-400">
        <p>
          Every figure reads a canonical <code>v_metric_*</code> view; no threshold or predicate is
          computed in the browser. Ratios are actual ÷ estimate on completed tasks with both sides
          above zero; the in-band window (0.8–1.2) and the exact-match window live in{' '}
          <code>v_metric_config</code> on the database and are retuned there, never here.
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
