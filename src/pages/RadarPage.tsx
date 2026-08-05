import { useEffect, useState } from 'react'
import {
  fetchRadarQueue,
  fetchBurningTasks,
  fetchApproachingTasks,
  fetchProjectMonthHours,
  fetchCompanyVitals,
  fetchUntaggedActiveProjects,
  fetchUserNames,
  monthAxis,
  type RadarQueueRow,
  type BleedingTask,
  type ProjectMonthHours,
  type CompanyVitals,
} from '@/lib/queries'
import { describeError } from '@/lib/errors'
import { FreshnessStamp } from '@/components/radar/FreshnessStamp'
import { AttentionQueue } from '@/components/radar/AttentionQueue'
import { BleedingNow } from '@/components/radar/BleedingNow'
import { QueueDepthNotice } from '@/components/radar/QueueDepthNotice'
import { VitalsTiles } from '@/components/radar/VitalsTiles'

/** Sparkline + vitals window. Monthly grain — see VitalsTiles' note. */
const TREND_MONTHS = 12

/**
 * Which sections can fail independently.
 *
 * Radar loads six queries. `Promise.all` would let one failure blank all three
 * blocks, and an early-warning page that goes dark because a vitals tile timed
 * out is worse than one showing four of five sections. Each section therefore
 * carries its own failure, and a section that failed says so instead of
 * rendering its empty state.
 */
type SectionKey = 'queue' | 'burning' | 'approaching' | 'vitals'

/**
 * Radar — the landing page (plan §4.1).
 *
 * "What needs my attention *this week*, before anyone complains?" Three blocks,
 * in the order §8 gives them: the attention queue (projects ranked by
 * exposure), the two bleeding-now task lists, and the company vitals.
 *
 * There is no period switcher on purpose. Every signal here is defined against
 * a fixed window the metric owns (14 days of activity, 4 weeks of burn, 6 weeks
 * of backlog, 90 days of coverage), so a period control would either lie about
 * what it filters or silently break the signal definitions.
 */
export function RadarPage() {
  const [queue, setQueue] = useState<RadarQueueRow[]>([])
  const [series, setSeries] = useState<Map<number, ProjectMonthHours[]>>(new Map())
  const [burning, setBurning] = useState<BleedingTask[]>([])
  const [approaching, setApproaching] = useState<BleedingTask[]>([])
  const [vitals, setVitals] = useState<CompanyVitals | null>(null)
  const [untagged, setUntagged] = useState(0)
  const [assignees, setAssignees] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState<Partial<Record<SectionKey, string>>>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [queueR, burningR, approachingR, monthsR, vitalsR, untaggedR] = await Promise.allSettled(
        [
          fetchRadarQueue(),
          fetchBurningTasks(),
          fetchApproachingTasks(),
          fetchProjectMonthHours(TREND_MONTHS),
          fetchCompanyVitals(TREND_MONTHS),
          fetchUntaggedActiveProjects(),
        ],
      )
      if (cancelled) return

      const problems: Partial<Record<SectionKey, string>> = {}

      if (queueR.status === 'fulfilled') setQueue(queueR.value)
      else problems.queue = describeError(queueR.reason)

      if (burningR.status === 'fulfilled') setBurning(burningR.value)
      else problems.burning = describeError(burningR.reason)

      if (approachingR.status === 'fulfilled') setApproaching(approachingR.value)
      else problems.approaching = describeError(approachingR.reason)

      if (vitalsR.status === 'fulfilled') setVitals(vitalsR.value)
      else problems.vitals = describeError(vitalsR.reason)

      // The sparklines and the untagged alarm are decoration on top of the
      // queue, not the queue itself — losing either degrades a row rather than
      // failing the section, so neither raises a section error.
      if (monthsR.status === 'fulfilled') {
        // A month a project logged nothing in has no row at all. Plot it as a
        // zero rather than closing the gap — a flat line through a dead month
        // is exactly the shape a spinning-then-silent project should show.
        const axis = monthAxis(TREND_MONTHS)
        const hoursByProjectMonth = new Map<string, number>()
        const projectIds = new Set<number>()
        for (const row of monthsR.value) {
          hoursByProjectMonth.set(`${row.project_id}|${row.month.slice(0, 10)}`, row.hours)
          projectIds.add(row.project_id)
        }
        const byProject = new Map<number, ProjectMonthHours[]>()
        for (const project_id of projectIds) {
          byProject.set(
            project_id,
            axis.map((month) => ({
              project_id,
              month,
              hours: hoursByProjectMonth.get(`${project_id}|${month}`) ?? 0,
            })),
          )
        }
        setSeries(byProject)
      }
      if (untaggedR.status === 'fulfilled') setUntagged(untaggedR.value)

      setFailed(problems)
      setLoading(false)

      const ids = [
        ...(burningR.status === 'fulfilled' ? burningR.value : []),
        ...(approachingR.status === 'fulfilled' ? approachingR.value : []),
      ]
        .map((t) => t.assignee_id)
        .filter((id): id is number => id != null)
      try {
        const names = await fetchUserNames(ids)
        if (!cancelled) setAssignees(names)
      } catch {
        // Names are a nicety; the rows carry task, project, band and hours
        // without them. Never fail a row over a missing display name.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Radar</h1>
          <p className="text-xs text-neutral-500">
            What needs attention this week, before anyone complains. Signals fire on the 65
            client-delivery projects in scope, over tasks created since 2025-01-01.
          </p>
        </div>
        <FreshnessStamp />
      </div>

      <AttentionQueue
        rows={queue}
        series={series}
        loading={loading}
        error={failed.queue}
        untaggedActiveProjects={untagged}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-neutral-900">Bleeding now</h2>
          <p className="text-xs text-neutral-500">
            The task-level view of the same work — every open task in scope that is over its
            estimate or about to be.
          </p>
        </div>
        <QueueDepthNotice
          burning={burning.length}
          approaching={approaching.length}
          loading={loading}
          incomplete={Boolean(failed.burning || failed.approaching)}
        />
        <BleedingNow
          burning={burning}
          approaching={approaching}
          assignees={assignees}
          loading={loading}
          burningError={failed.burning}
          approachingError={failed.approaching}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-neutral-900">Company vitals</h2>
          <p className="text-xs text-neutral-500">
            The slow-moving numbers nobody was watching. Monthly, last {TREND_MONTHS} months.
          </p>
        </div>
        <VitalsTiles vitals={vitals} loading={loading} error={failed.vitals} />
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        Every threshold behind a firing signal lives in one SQL config view on the database
        (<code>v_metric_config</code>) and is reviewed after the first four weeks of use, then
        quarterly — tightened only when the queue is chronically over-depth and the tail rows are
        genuinely low-stakes, never to make this page look calm. Container “bucket” tasks are
        excluded from the overrun alarms so the queue does not drown in false positives.
      </p>
    </div>
  )
}
