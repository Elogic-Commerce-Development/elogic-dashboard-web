import { Link } from '@tanstack/react-router'
import { Sparkline } from '@/components/radar/Sparkline'
import { TrustFlagNote } from '@/components/people/TrustFlagNote'
import { calibrationState, trustFlag } from '@/lib/peopleCoaching'
import type { PersonCalibration, PersonMonthPoint, PersonUtilization } from '@/lib/queries'
import { formatHours } from '@/lib/format'

export type PersonCardData = {
  user_id: number
  display_name: string
  department_name: string | null
  position_name: string | null
  merged_identities: number
  /** All segments — "what they worked on". */
  hours: number
  tasks: number
  /** Estimating segments only — §4.5's coverage denominator. */
  estimatingHours: number
  estimatingUnestimatedHours: number
  coveragePct: number | null
  calibration: PersonCalibration | undefined
  utilization: PersonUtilization | undefined
  months: PersonMonthPoint[]
}

/**
 * §4.5's coaching card — "the unit of design — comparable, printable for 1:1
 * prep".
 *
 * Three things this deliberately is **not**:
 *
 *  - **Not a scorecard.** There is no composite score, no grade and no rank.
 *    §4.5: "No composite 'worst person' sort", §2.5: "Coach, don't rank."
 *  - **Not confident about small samples.** Below §5's n-floor the calibration
 *    figures do not render at all — not greyed out, not in a tooltip. §4.5:
 *    "metrics suppress below floor-n rather than rendering misleading
 *    precision."
 *  - **Not a verdict on anyone.** The one flag it can raise is a question with
 *    its mechanism evidence attached (see `TrustFlagNote`).
 *
 * Every figure states the window it was measured over, because the card mixes
 * three of them on purpose: calibration is the all-time §5 sample, coverage is
 * all-time, load is the last complete month, and the trend is the last six.
 */
export function PersonCard({ d, floor }: { d: PersonCardData; floor: number }) {
  const cal = calibrationState(d.calibration, floor)
  const flag = trustFlag(d.calibration, floor)

  const series = d.months.map((m) => m.total_hours)
  const coverageTone =
    d.coveragePct == null ? 'neutral' : d.coveragePct >= 60 ? 'emerald' : d.coveragePct >= 30 ? 'amber' : 'red'

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3.5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/people/$userId"
            params={{ userId: String(d.user_id) }}
            className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
          >
            {d.display_name}
          </Link>
          <p className="truncate text-[11px] text-neutral-500">
            {d.position_name ?? 'Position not recorded'}
            {d.merged_identities > 0 && (
              <span
                className="ml-1.5 rounded bg-neutral-100 px-1 py-px text-[10px] text-neutral-600"
                title={`${d.merged_identities} duplicate account${d.merged_identities === 1 ? '' : 's'} merged into this person (S4/R6). Their history is combined here.`}
              >
                merged ×{d.merged_identities + 1}
              </span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums text-neutral-900">
            {formatHours(d.hours)}
          </div>
          <div className="text-[10px] text-neutral-500">{d.tasks} tasks · all time</div>
        </div>
      </header>

      {/* ── Calibration (§5 attribution rule, all-time sample) ────────────── */}
      <section className="rounded border border-neutral-150 bg-neutral-50/60 px-2.5 py-2">
        <div className="mb-1 flex items-baseline justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
            Calibration
          </h4>
          <span className="text-[10px] text-neutral-400">all-time sample</span>
        </div>

        {cal.kind === 'shown' ? (
          <>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <Figure label={`median (n=${cal.c.n})`} value={cal.c.median_ratio?.toFixed(2) ?? '—'} />
              <Figure label="p90" value={cal.c.p90_ratio?.toFixed(2) ?? '—'} muted />
              <Figure
                label="in-band"
                value={cal.c.in_band_pct == null ? '—' : `${Math.round(cal.c.in_band_pct)}%`}
              />
              {/* §5: exact-match % is "always displayed with in-band %" —
                  they sit side by side, never one without the other. */}
              <Figure
                label="exact"
                value={cal.c.exact_match_pct == null ? '—' : `${Math.round(cal.c.exact_match_pct)}%`}
                muted={!cal.c.exact_match_flagged}
                warn={cal.c.exact_match_flagged}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-neutral-500">
              Ratio of actual to estimate on completed tasks where they logged ≥40% of the hours.{' '}
              <Link
                to="/people/$userId"
                params={{ userId: String(d.user_id) }}
                className="text-blue-600 hover:underline"
              >
                Quarterly history →
              </Link>
            </p>
          </>
        ) : cal.kind === 'below-floor' ? (
          <p className="text-[11px] leading-snug text-neutral-500">
            <span className="font-medium text-neutral-700">n = {cal.n}</span> — below the n ≥{' '}
            {cal.floor} sample floor, so no calibration figures are shown. A median over {cal.n}{' '}
            task{cal.n === 1 ? '' : 's'} would look like a measurement and behave like noise.
          </p>
        ) : (
          <p className="text-[11px] leading-snug text-neutral-500">
            No completed estimated task is attributed to them — they hold ≥40% of the hours on none
            of them. Nothing to calibrate, which is not the same as calibrating badly.
          </p>
        )}
      </section>

      {/* ── The trust flag, only ever above the floor ─────────────────────── */}
      {flag && <TrustFlagNote flag={flag} compact />}

      {/* ── Coverage · Load · Utilization ─────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-2 text-center">
        <Figure
          label="coverage"
          value={d.coveragePct == null ? '—' : `${Math.round(d.coveragePct)}%`}
          tone={coverageTone}
          sub={`${formatHours(d.estimatingUnestimatedHours)} unpriced`}
          title="Share of their hours on estimated tasks, within fixed-scope and maintenance projects only. T&M and internal work carries no estimates by design and is excluded from this denominator."
        />
        <Figure
          label="last month"
          value={d.months.length ? formatHours(d.months[d.months.length - 1].total_hours) : '—'}
          sub={
            d.months.length
              ? `${d.months[d.months.length - 1].projects_touched} projects`
              : 'no hours'
          }
          title="Hours logged and distinct in-scope projects touched in the most recent complete calendar month. 4+ projects is the visible fragmentation tier (§4.5)."
        />
        <Figure
          label="utilization"
          value={
            d.utilization?.utilization_pct == null
              ? '—'
              : `${Math.round(d.utilization.utilization_pct)}%`
          }
          sub={
            d.utilization
              ? `${formatHours(d.utilization.tracked_hours)} / ${formatHours(d.utilization.expected_hours)}`
              : 'not PF-linked'
          }
          muted
          title="Tracked ÷ expected for the last complete month, against the R4-repaired capacity (terminated staff and the PSP mirror excluded). Company-wide this runs low — read it beside leave, not alone."
        />
      </section>

      <footer className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
        <span className="text-[10px] text-neutral-400">hours / month, last 6</span>
        <Sparkline
          values={series}
          tone="neutral"
          lastIsPartial={false}
          title={`Monthly hours: ${series.map((v) => v.toFixed(1)).join(', ')}`}
        />
      </footer>
    </article>
  )
}

function Figure({
  label,
  value,
  sub,
  muted = false,
  warn = false,
  tone,
  title,
}: {
  label: string
  value: string
  sub?: string
  muted?: boolean
  warn?: boolean
  tone?: 'red' | 'amber' | 'emerald' | 'neutral'
  title?: string
}) {
  const color = warn
    ? 'text-amber-700'
    : tone === 'red'
      ? 'text-red-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'emerald'
          ? 'text-emerald-600'
          : muted
            ? 'text-neutral-500'
            : 'text-neutral-900'
  return (
    <div title={title}>
      <div className={`text-sm font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] leading-tight text-neutral-500">{label}</div>
      {sub && <div className="text-[10px] leading-tight text-neutral-400">{sub}</div>}
    </div>
  )
}
