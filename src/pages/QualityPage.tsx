import { useEffect, useMemo, useState } from 'react'
import { FreshnessStamp } from '@/components/radar/FreshnessStamp'
import { Block, LoadFailure, Loading, Panel, StatTile } from '@/components/estimation/Section'
import { CoverageScoreboard } from '@/components/quality/CoverageScoreboard'
import { LiveQaAlarms } from '@/components/quality/LiveQaAlarms'
import { ReturnedRateTrend } from '@/components/quality/ReturnedRateTrend'
import { ReworkLadder } from '@/components/quality/ReworkLadder'
import {
  fetchCompletedTaskCoverage,
  fetchMetricConfig,
  fetchQaCompletedTasks,
  fetchReturnedRateByProject,
  fetchSecondRoundTasks,
  type CompletedTaskCoverage,
  type QaCompletedTask,
  type ReturnedRateRow,
  type SecondRoundTask,
} from '@/lib/queries'
import {
  buildQualityTrend,
  buildReworkLadder,
  coverageBySource,
  formatPct,
  summariseQuality,
} from '@/lib/quality'
import {
  CAP_NOTE,
  QA_BUGS_COLLECTING_SINCE,
  RETURNED_RATE_MIN_SAMPLE_FALLBACK,
  qaCoverageTone,
  returnedRateTone,
} from '@/lib/qualityPolicy'
import { describeError } from '@/lib/errors'

type BlockKey = 'ladder' | 'scoreboard' | 'alarms'

/**
 * §4.3 Quality — "What does rework cost and where does it come from?"
 *
 * ── Load shape (load-bearing, not tidiness) ────────────────────────────────
 *
 * Two waves. Everything cheap goes first so the page paints, and the single
 * `v_metric_tasks` read (2.11s, the live alarms) runs alone afterwards. That
 * view materialises the whole §5 attribution machinery before applying any
 * filter, which is what put F4's Calibration block over the `authenticated`
 * role's 8s cap; the rest of this page deliberately reads `v_scope_tasks`
 * instead, at 0.08s, having first *measured* that the two agree exactly on
 * every figure shown here (see the queries.ts section header).
 *
 * Wave 1's coverage denominator is a second, deliberately narrow read of the
 * same view: `completed_on, qa_iterations` over all 3,171 completed tasks costs
 * 0.26s, where the same filter at eleven columns costs 2.31s. On this view
 * width dominates row count, so the two reads together are cheaper than one
 * wide one.
 *
 * Failures stay per block (F3's lesson): a block whose query died must never
 * render its empty state. "No open task is on a 2nd+ QA round" is excellent
 * news and a failed query must not be able to say it.
 */
export function QualityPage() {
  const [tasks, setTasks] = useState<QaCompletedTask[]>([])
  const [completed, setCompleted] = useState<CompletedTaskCoverage[]>([])
  const [projects, setProjects] = useState<ReturnedRateRow[]>([])
  const [alarms, setAlarms] = useState<SecondRoundTask[]>([])
  const [minSample, setMinSample] = useState(RETURNED_RATE_MIN_SAMPLE_FALLBACK)
  const [pending, setPending] = useState<Record<BlockKey, boolean>>({
    ladder: true,
    scoreboard: true,
    alarms: true,
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
      // ── Wave 1: the cheap reads. Both blocks depend on both fetches, so
      //    they land together.
      const [taskRows, completedRows, projectRows, config] = await Promise.allSettled([
        fetchQaCompletedTasks(),
        fetchCompletedTaskCoverage(),
        fetchReturnedRateByProject(),
        fetchMetricConfig(),
      ])
      if (cancelled) return

      const failure = [taskRows, completedRows, projectRows].find((r) => r.status === 'rejected')
      if (failure && failure.status === 'rejected') {
        fail('ladder', failure.reason)
        fail('scoreboard', failure.reason)
      }
      if (taskRows.status === 'fulfilled') setTasks(taskRows.value)
      if (completedRows.status === 'fulfilled') setCompleted(completedRows.value)
      if (projectRows.status === 'fulfilled') setProjects(projectRows.value)
      // The floor only decides whether a percentage renders, never a number.
      if (config.status === 'fulfilled') setMinSample(config.value.person_min_sample)
      done('ladder')
      done('scoreboard')

      // ── Wave 2: the one v_metric_tasks read, alone.
      try {
        const rows = await fetchSecondRoundTasks()
        if (!cancelled) setAlarms(rows)
      } catch (e) {
        fail('alarms', e)
      }
      done('alarms')
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => summariseQuality(tasks, projects), [tasks, projects])
  const ladder = useMemo(() => buildReworkLadder(tasks), [tasks])
  const trend = useMemo(() => buildQualityTrend(tasks, completed), [tasks, completed])
  const bySource = useMemo(() => coverageBySource(projects), [projects])

  const dataReady = !pending.ladder && !failed.ladder
  // §2's honesty principle. The headline is §5's metric over the whole in-scope
  // population — but 83% of the tasks it can see are Jira's, because Jira labels
  // 86.6% of its completions and ActiveCollab labels 4.7%. The number is not
  // wrong; presenting it without its composition would be.
  const jiraCovered = bySource.find((c) => c.source === 'jira')?.qa_covered_tasks ?? 0
  const jiraShareOfSample =
    summary.qa_covered_tasks > 0 ? (jiraCovered / summary.qa_covered_tasks) * 100 : null
  const cleanRung = ladder[0]
  const worstRung = ladder[2]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Quality</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-neutral-500">
            What does rework cost, and where does it come from? Every figure is the share of
            tasks that <em>carry a QA iteration count</em> — a number that is itself only{' '}
            {dataReady ? formatPct(summary.qa_coverage_pct) : '…'} of completed work, so the
            coverage scoreboard below is as much the subject of this page as the returned rate is.
            In-scope projects, tasks created since 2025-01-01.
          </p>
        </div>
        <FreshnessStamp />
      </div>

      {/* ── Headline ─────────────────────────────────────────────────────── */}
      {failed.ladder ? (
        <LoadFailure what="The quality sample" error={failed.ladder} />
      ) : pending.ladder ? (
        <Loading what="the quality sample" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Returned rate"
            value={formatPct(summary.returned_pct)}
            tone={returnedRateTone(summary.returned_pct)}
            emphasis
            caption={
              <>
                {summary.returned_tasks} of n={summary.qa_covered_tasks} QA-covered completions came
                back for a 2nd+ round
                {jiraShareOfSample == null ? null : (
                  <>
                    {' '}
                    — but {jiraShareOfSample.toFixed(0)}% of that sample is Jira, so this sits much
                    closer to Jira's number than to a company one
                  </>
                )}
              </>
            }
          />
          <StatTile
            label="QA coverage"
            value={formatPct(summary.qa_coverage_pct)}
            tone="amber"
            caption={
              <>
                only {summary.qa_covered_tasks} of {summary.completed_tasks} completed tasks carry
                an iteration count — everything else here is blind to the rest
              </>
            }
          />
          <StatTile
            label="Cost of a clean ticket"
            value={
              cleanRung?.avg_actual_hours == null
                ? '—'
                : `${cleanRung.avg_actual_hours.toFixed(1)}h`
            }
            tone="emerald"
            caption={<>average actual hours, one QA round, n={cleanRung?.tasks ?? 0}</>}
          />
          <StatTile
            label="Cost of a 3rd+ round"
            value={
              worstRung?.avg_actual_hours == null
                ? '—'
                : `${worstRung.avg_actual_hours.toFixed(1)}h`
            }
            tone="red"
            caption={
              <>
                {cleanRung?.avg_actual_hours && worstRung?.avg_actual_hours
                  ? `${(worstRung.avg_actual_hours / cleanRung.avg_actual_hours).toFixed(1)}× a clean ticket · `
                  : ''}
                n={worstRung?.tasks ?? 0}
              </>
            }
          />
        </div>
      )}

      {/* ── §4.3 Rework cost ladder ──────────────────────────────────────── */}
      <Block
        title="Rework cost ladder"
        blurb="What a return actually costs, in hours rather than in counts. Each rung is the average actual hours of a completed task that went through that many QA rounds, with the share of the rung's estimated tasks that overran their estimate."
      >
        {failed.ladder ? (
          <LoadFailure what="The rework ladder" error={failed.ladder} />
        ) : pending.ladder ? (
          <Loading what="the rework ladder" />
        ) : (
          <Panel
            title="Hours per ticket, by QA rounds"
            blurb="Completed, in-scope, carrying an iteration count."
            meta={<>n={summary.qa_covered_tasks} · iterations capped at 5+</>}
          >
            <ReworkLadder rungs={ladder} />
            <p className="border-t border-neutral-100 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
              {CAP_NOTE} <span className="font-medium text-neutral-600">On the overrun rates:</span>{' '}
              §4.3 illustrates this ladder as 21% → 47% → 64%. Those reproduce as the share of
              tasks running above <em>1.2×</em> estimate — §5's in-band ceiling — which on today's
              data reads 22.2% → 44.6% → 62.3%. (Not "out of band": §5's band is two-sided,
              0.8–1.2, so its complement would sweep in underruns too.) The rates above instead use
              §5's own definition of an overrun task — any actual above estimate — because that is
              what "overrun" already means on the Estimation page and the Projects index, and one
              word cannot mean two things across three pages.
            </p>
          </Panel>
        )}
      </Block>

      {/* ── §4.3 Returned-rate trend ─────────────────────────────────────── */}
      <Block
        title="Returned rate over time"
        blurb="The share of QA-covered completions sent back for a 2nd+ round, by completion month. The dashed line is the sample it is computed from — coverage swings hard month to month, and a rate without its n invites a trend that is really a labelling change."
      >
        {failed.ladder ? (
          <LoadFailure what="The returned-rate trend" error={failed.ladder} />
        ) : pending.ladder ? (
          <Loading what="the returned-rate trend" />
        ) : (
          <Panel
            title="Returned rate by completion month"
            meta={
              <>
                {trend.filter((m) => m.qa_covered_tasks > 0).length} of {trend.length} months carry
                a QA-covered completion
              </>
            }
          >
            <ReturnedRateTrend months={trend} />
          </Panel>
        )}
      </Block>

      {/* ── §4.3 Live alarms ─────────────────────────────────────────────── */}
      <Block
        title="Live alarms"
        blurb="Open tasks already on their 2nd+ QA round — the same signal Radar fires per project, here at ticket grain so it has somewhere to land."
      >
        {failed.alarms ? (
          <LoadFailure what="Live QA alarms" error={failed.alarms} />
        ) : pending.alarms ? (
          <Loading what="live QA alarms" />
        ) : (
          <Panel
            title="Open tasks on a 2nd+ QA round"
            meta={<>{alarms.length} open</>}
          >
            <LiveQaAlarms tasks={alarms} />
          </Panel>
        )}
      </Block>

      {/* ── §4.3 Coverage scoreboard ─────────────────────────────────────── */}
      <Block
        title="Coverage scoreboard"
        blurb="Which projects actually record QA iterations. This is the blind spot made into a managed number: a project at 0% coverage has no quality signal at all, and that is a fact about the process rather than about the code."
      >
        {failed.scoreboard ? (
          <LoadFailure what="The coverage scoreboard" error={failed.scoreboard} />
        ) : pending.scoreboard ? (
          <Loading what="the coverage scoreboard" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {bySource.map((cut) => (
                <StatTile
                  key={cut.source}
                  label={`${cut.label} — QA coverage`}
                  value={formatPct(cut.qa_coverage_pct)}
                  tone={qaCoverageTone(cut.qa_coverage_pct)}
                  caption={
                    <>
                      {cut.qa_covered_tasks} of {cut.completed_tasks} completed tasks carry an
                      iteration count
                    </>
                  }
                />
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-500">
              These two tiles carry <em>coverage only, deliberately</em>. Jira derives iterations
              from the issue changelog automatically; ActiveCollab depends on somebody applying a
              label. §4.3 rules out cross-source comparisons, so no returned rate is shown beside
              them — and the reason is selection, not sample size. Jira's rate would describe
              essentially all of its completed work; ActiveCollab's would describe the small
              minority of tickets somebody chose to label, which is not a random sample of
              anything. The gap between these two numbers is a fact about process, not about the
              teams. Per-project returned rates are in the table below, where each row has one
              source and one n.
            </p>
            <CoverageScoreboard rows={projects} minSample={minSample} />
          </>
        )}
      </Block>

      {/* ── Scope + provenance footer ────────────────────────────────────── */}
      <div className="space-y-1.5 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-500">
        <p>
          <span className="font-medium text-neutral-600">Scope.</span> The 65 in-scope
          outsourcing ∪ Jira projects, tasks created on or after 2025-01-01. Returned rate is §5's:
          the share of <em>QA-covered completed</em> tasks with two or more iterations, always shown
          with its n and its coverage.
        </p>
        {/*
          These two lines quote counts off the same sample the blocks above
          render. If that fetch failed or is still in flight the counts are
          zeros over an empty array — "0 of 0 completions carry a bug count"
          reads as a measured finding about the data rather than as a missing
          query. Same rule as the blocks: never state a number we did not measure.
        */}
        <p>
          <span className="font-medium text-neutral-600">QA bugs.</span> Collecting since{' '}
          {QA_BUGS_COLLECTING_SINCE}, when the PSP team's numeric field started mapping into the
          schema
          {dataReady
            ? ` — ${summary.tasks_with_bug_counts} of ${summary.qa_covered_tasks} QA-covered completions carry a count so far`
            : ''}
          . Too young to trend; shown per ticket on the alarms above and on task detail, not
          aggregated into a rate here.
        </p>
        <p>
          <span className="font-medium text-neutral-600">Caps.</span> {CAP_NOTE}
          {dataReady
            ? ` ${summary.capped_tasks} of the ${summary.qa_covered_tasks} tasks in this sample are at the iteration cap.`
            : ''}
        </p>
        <p>
          <span className="font-medium text-neutral-600">Not on this page.</span> §4.3's bug-inflow
          band is absent, because deciding what counts as a bug is a new metric definition rather
          than a reading of an existing one. ActiveCollab carries <code>BUG</code>,{' '}
          <code>EPICOR BUG</code>, <code>SLACK BUG</code> and <code>BUG_RELEASE</code> labels — and
          a <code>NOT A BUG</code> label, which is its own problem for any naive rule. Jira's
          natural equivalents are its issue type and its own labels — the sync <em>already requests
          both</em> from the API and stores neither, so nothing in the schema carries them and no
          Jira task carries a bug label today. So the choice is two decisions, not one — what counts as a bug, and whether the
          band is AC-only like write-off or waits on persisting the Jira field. Both belong to the
          owner and then to SQL; logged as an open question rather than approximated here.
        </p>
      </div>
    </div>
  )
}
