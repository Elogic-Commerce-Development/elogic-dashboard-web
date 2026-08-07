import { useEffect, useMemo, useState } from 'react'
import { FreshnessStamp } from '@/components/radar/FreshnessStamp'
import { Block, LoadFailure, Loading, Panel, StatTile } from '@/components/estimation/Section'
import { SegmentSplit } from '@/components/writeoffs/SegmentSplit'
import { WriteoffLedger } from '@/components/writeoffs/WriteoffLedger'
import { WriteoffTrendChart } from '@/components/writeoffs/WriteoffTrendChart'
import {
  fetchWriteoffByMonth,
  fetchWriteoffByProject,
  fetchWriteoffBySegment,
  type WriteoffMonthRow,
  type WriteoffProjectRow,
  type WriteoffSegmentRow,
} from '@/lib/queries'
import {
  deliverySegments,
  foldWriteoffMonths,
  splitCostOfSale,
  summariseWriteoff,
  trailingBaseline,
} from '@/lib/writeoffs'
import { MONTHLY_ALERT_PCT, PINNED_BASELINE_PCT } from '@/lib/writeoffPolicy'
import { formatHours } from '@/lib/format'
import { describeError } from '@/lib/errors'

type BlockKey = 'trend' | 'ledger' | 'segments'

function pct(v: number | null, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v.toFixed(digits)}%`
}

/**
 * §4.4 Write-offs — "Which hours are we eating and why?"
 *
 * ── Load shape ─────────────────────────────────────────────────────────────
 *
 * One wave. All three views are record-grain rollups off `time_records` with no
 * task-grain join, and all three come back in ~0.1s as role `authenticated`
 * (0.13s / 0.12s / 0.11s, measured 2026-08-06 projecting every column). Nothing
 * on this page goes near `v_metric_tasks`, so there is no 8s-cap hazard to
 * stage around — the whole point of §5 defining write-off at record grain.
 *
 * ── AC-only, and saying so ─────────────────────────────────────────────────
 *
 * §4.4 opens with "AC-only, labeled as such; Jira rendered as an explicit
 * 'untagged' class". Jira has no billable flag at source, so its hours are
 * carried as their own total and kept out of every denominator. A Jira project
 * therefore reads "untagged", never 0% — the difference between "we bill all of
 * it" and "nobody has said".
 */
export function WriteOffsPage() {
  const [months, setMonths] = useState<WriteoffMonthRow[]>([])
  const [projects, setProjects] = useState<WriteoffProjectRow[]>([])
  const [segments, setSegments] = useState<WriteoffSegmentRow[]>([])
  const [pending, setPending] = useState<Record<BlockKey, boolean>>({
    trend: true,
    ledger: true,
    segments: true,
  })
  const [failed, setFailed] = useState<Partial<Record<BlockKey, string>>>({})

  useEffect(() => {
    let cancelled = false
    const fail = (key: BlockKey, reason: unknown) => {
      if (!cancelled) setFailed((f) => ({ ...f, [key]: describeError(reason) }))
    }

    async function load() {
      const [monthRows, projectRows, segmentRows] = await Promise.allSettled([
        fetchWriteoffByMonth(),
        fetchWriteoffByProject(),
        fetchWriteoffBySegment(),
      ])
      if (cancelled) return

      if (monthRows.status === 'fulfilled') setMonths(monthRows.value)
      else fail('trend', monthRows.reason)

      if (projectRows.status === 'fulfilled') setProjects(projectRows.value)
      else fail('ledger', projectRows.reason)

      if (segmentRows.status === 'fulfilled') setSegments(segmentRows.value)
      else fail('segments', segmentRows.reason)

      setPending({ trend: false, ledger: false, segments: false })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const series = useMemo(() => foldWriteoffMonths(months), [months])
  const headline = useMemo(() => summariseWriteoff(projects), [projects])
  // §4.4's chart is "monthly write-off % vs **baseline**", and §5 defines that
  // baseline as the since-2025 company share (pinned ~8.8%). Use that — read
  // live off the same data rather than hard-coded — not the trailing six-month
  // figure: a month compared against the average of the months around it can
  // only ever look average, which is the opposite of a drift signal. The
  // trailing figure is still computed and shown beside the chart as context.
  const baseline = headline.company.writeoff_pct
  const trailing = useMemo(() => trailingBaseline(series), [series])
  const split = useMemo(() => splitCostOfSale(projects), [projects])
  const delivery = useMemo(() => deliverySegments(segments), [segments])

  // A month with no tagged hours at all has no write-off percentage to be over
  // or under the line, so it belongs in neither side of the ratio. Including it
  // in the denominator alone would quietly report a healthier "N of M" than the
  // data supports.
  const closed = series.filter((m) => !m.partial && m.company_pct != null)
  const overAlert = closed.filter((m) => (m.company_pct ?? 0) >= MONTHLY_ALERT_PCT)
  const latestClosed = closed[closed.length - 1] ?? null
  const ledgerReady = !pending.ledger && !failed.ledger

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Write-offs</h1>
          <p className="max-w-3xl text-xs leading-relaxed text-neutral-500">
            Which hours are we eating, and why? Non-billable ÷ (billable + non-billable), on time
            records dated 2025-01-01 or later. ActiveCollab only — Jira carries no billable flag at
            source, so its hours are an explicit untagged class and never counted as billable.
            Company-wide by design: the pinned {PINNED_BASELINE_PCT}% baseline is a company number,
            and it splits sharply once you separate delivery from internal work.
          </p>
        </div>
        <FreshnessStamp />
      </div>

      {/* ── Headline ─────────────────────────────────────────────────────── */}
      {failed.ledger ? (
        <LoadFailure what="The write-off headline" error={failed.ledger} />
      ) : pending.ledger ? (
        <Loading what="the write-off headline" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Company write-off"
            value={pct(headline.company.writeoff_pct, 2)}
            emphasis
            tone={
              (headline.company.writeoff_pct ?? 0) >= MONTHLY_ALERT_PCT ? 'red' : 'neutral'
            }
            caption={
              <>
                {formatHours(headline.company.non_billable_hours)} of{' '}
                {formatHours(
                  headline.company.non_billable_hours + headline.company.billable_hours,
                )}{' '}
                tagged · §5 pins the baseline at {PINNED_BASELINE_PCT}%
              </>
            }
          />
          <StatTile
            label="In-scope delivery"
            value={pct(headline.inScope.writeoff_pct, 2)}
            tone="red"
            caption={
              <>
                {formatHours(headline.inScope.non_billable_hours)} written off across the 65
                dashboard-scope projects — the hours a delivery manager can act on
              </>
            }
          />
          <StatTile
            label="Out of scope"
            value={pct(headline.outOfScope.writeoff_pct, 2)}
            tone="emerald"
            caption={
              <>
                {formatHours(headline.outOfScope.non_billable_hours)} — mostly outstaff and
                white-label delivery, which writes off almost nothing
              </>
            }
          />
          {/*
            A successful query that returns no usable month is not an all-clear
            either: PostgREST answers 200 with `[]` when RLS denies rows on a
            backing relation — a trap this project has already shipped once — so
            "0 of 0" must never wear the healthy colour.

            This tile lives in the headline row but its data comes from the
            *month* fetch, not the project fetch the row is gated on. Gate it
            separately or a failed month query renders a green "0 of 0" —
            a confident all-clear over a dead query, which is the F3 defect
            this codebase has now shipped twice.
          */}
          <StatTile
            label="Months over the alert line"
            value={
              failed.trend
                ? '—'
                : pending.trend
                  ? '…'
                  : closed.length === 0
                    ? '—'
                    : `${overAlert.length} of ${closed.length}`
            }
            tone={
              failed.trend || pending.trend || closed.length === 0
                ? 'neutral'
                : overAlert.length > 0
                  ? 'amber'
                  : 'emerald'
            }
            caption={
              failed.trend ? (
                <span className="text-red-700">
                  The monthly series could not be loaded — this is not zero months over the line.
                </span>
              ) : pending.trend ? (
                <>loading the monthly series…</>
              ) : closed.length === 0 ? (
                <span className="text-amber-700">
                  The monthly series returned no closed month with tagged hours. That is not zero
                  months over the line — it is nothing measured.
                </span>
              ) : (
                <>
                  closed months at or above {MONTHLY_ALERT_PCT}% company write-off
                  {latestClosed ? ` · latest closed month ${pct(latestClosed.company_pct)}` : ''}
                </>
              )
            }
          />
        </div>
      )}

      {/* ── §4.4 Monthly trend ───────────────────────────────────────────── */}
      <Block
        title="Monthly write-off vs baseline"
        blurb={`Bars are the whole company, the line is the 65 in-scope delivery projects — they run 2–4× apart, which is why the company figure alone tells a delivery manager nothing. The grey line is §5's baseline: the company's own since-2025 write-off share. The red line is the ${MONTHLY_ALERT_PCT}% alert. Bars are coloured against those two lines and nothing else.`}
      >
        {failed.trend ? (
          <LoadFailure what="The monthly write-off trend" error={failed.trend} />
        ) : pending.trend ? (
          <Loading what="the monthly write-off trend" />
        ) : (
          <Panel
            title="Write-off % by month"
            blurb="Record grain, 2025+ records, ActiveCollab-tagged hours only."
            meta={
              trailing == null ? (
                <>trailing 6-month baseline unavailable</>
              ) : (
                <>trailing 6 closed months {pct(trailing)}</>
              )
            }
          >
            <WriteoffTrendChart months={series} baselinePct={baseline} />
            {baseline == null ? (
              <p className="border-t border-neutral-100 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                The baseline could not be loaded — it comes from the all-time project rollup, which
                is a different query from the monthly series. The bars are therefore drawn
                uncoloured rather than toned against a line that is not on the chart.
              </p>
            ) : null}
            <p className="border-t border-neutral-100 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
              The month in progress is drawn faint, dropped from the in-scope line entirely, and
              excluded from the trailing figure above: a month a few days old reads far above trend
              purely because non-billable admin lands before the billable delivery hours do, and
              plotting it like a closed month manufactures the very drift this chart exists to
              detect. It is <em>not</em> excluded from the grey baseline — that is §5's all-time
              company share, which has no upper date bound — but at barely a hundred tagged hours
              inside a 144,000-hour denominator it moves that line by under three hundredths of a
              point, so both readings round to the same number.
            </p>
          </Panel>
        )}
      </Block>

      {/* ── §4.4 Ledger ──────────────────────────────────────────────────── */}
      <Block
        title="Ledger by project"
        blurb="Ordered by hours written off, not by percentage — a project that writes off 99.7% of 588h and one that writes off 41.9% of 3,811h are different problems, and sorting by rate opens with the smaller one. Rows above the 15% line are flagged by the view itself."
      >
        {failed.ledger ? (
          <LoadFailure what="The write-off ledger" error={failed.ledger} />
        ) : pending.ledger ? (
          <Loading what="the write-off ledger" />
        ) : (
          <WriteoffLedger rows={projects} />
        )}
      </Block>

      {/* ── §4.4 Cost of sale ────────────────────────────────────────────── */}
      <Block
        title="Cost of sale, split out"
        blurb="Internal work — pre-sales, estimation, BA activities, internal PM — is non-billable by design. It is the cost of winning and running the business, not hours we failed to bill on an engagement, and adding the two together tells a manager to go fix pre-sales for doing its job."
      >
        {failed.ledger ? (
          <LoadFailure what="The cost-of-sale split" error={failed.ledger} />
        ) : pending.ledger ? (
          <Loading what="the cost-of-sale split" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <StatTile
              label="Delivery write-off"
              value={pct(split.delivery.writeoff_pct, 2)}
              tone="neutral"
              caption={
                <>
                  {formatHours(split.delivery.non_billable_hours)} non-billable on client
                  engagements — hours we ate
                </>
              }
            />
            <StatTile
              label="Cost of sale (internal)"
              value={formatHours(split.costOfSale.non_billable_hours)}
              tone="neutral"
              caption={
                <>
                  {split.costOfSaleProjects.length} internal projects at{' '}
                  {pct(split.costOfSale.writeoff_pct)} non-billable — reported, not judged as
                  write-off
                </>
              }
            />
            {ledgerReady && split.costOfSaleProjects.length > 0 ? (
              <div className="lg:col-span-2">
                <Panel
                  title="Internal projects behind the cost-of-sale figure"
                  meta={<>{formatHours(split.costOfSale.non_billable_hours)} total</>}
                >
                  <ul className="divide-y divide-neutral-100">
                    {split.costOfSaleProjects.slice(0, 8).map((p) => (
                      <li
                        key={p.project_id}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2 text-sm"
                      >
                        <span className="text-neutral-700">{p.project_name}</span>
                        <span className="tabular-nums text-xs text-neutral-500">
                          {formatHours(p.non_billable_hours)} non-billable ·{' '}
                          {p.writeoff_pct == null ? '—' : `${p.writeoff_pct.toFixed(1)}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            ) : null}
          </div>
        )}
      </Block>

      {/* ── §4.4 By segment ──────────────────────────────────────────────── */}
      <Block
        title="By work model"
        blurb="Fixed-scope, maintenance and T&M write off at incompatible rates — T&M bills the hour rather than the outcome, so it writes off almost nothing. One blended company average across the three describes no actual engagement."
      >
        {failed.segments ? (
          <LoadFailure what="The segment split" error={failed.segments} />
        ) : pending.segments ? (
          <Loading what="the segment split" />
        ) : (
          <Panel
            title="In-scope delivery segments"
            blurb="The 65 dashboard-scope projects, by their S2b work-model tag."
          >
            <SegmentSplit
              segments={delivery}
              emptyText="No in-scope project carries tagged billable hours."
            />
          </Panel>
        )}
      </Block>

      {/* ── Scope + provenance footer ────────────────────────────────────── */}
      <div className="space-y-1.5 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-500">
        <p>
          <span className="font-medium text-neutral-600">Definition.</span> §5's write-off:
          non-billable ÷ (billable + non-billable), at <em>record</em> grain, on records dated
          2025-01-01 or later. Deliberately not read through the task-linked scope view, whose floor
          is the task's creation date — that would drop 2025 records logged against older tasks.
        </p>
        <p>
          <span className="font-medium text-neutral-600">Jira.</span> No billable flag exists at
          source, so Jira hours are carried as an explicit untagged class and excluded from every
          denominator. "untagged" in the ledger means nobody has said, not that we billed all of it.
        </p>
        <p>
          <span className="font-medium text-neutral-600">Not on this page.</span> §4.4 also asks for
          a write-off split by discipline (BA / QA / Dev) and a rework overlap — hours both bug-ish
          and non-billable. Neither ships, for different reasons. The{' '}
          <strong>discipline split is buildable and is not blocked on any decision</strong>:{' '}
          <code>time_records</code> carries <code>job_type_id</code> and{' '}
          <code>billable_status</code> on the same row, and the same §5 predicate grouped by job
          type reproduces the plan's own figures (BA 40.2%, QA 16.4%, Development 6.1%). What is
          missing is only a <em>view</em> — and this session's backend scope was one view. The{' '}
          <strong>rework overlap</strong> additionally needs a rule for what counts as a bug, which
          is a new metric definition rather than a regrouping. Both are logged as open questions;
          neither is approximated here, because deriving either in the browser would put a second
          definition of a metric on a page whose whole premise is that there is one.
        </p>
      </div>
    </div>
  )
}
