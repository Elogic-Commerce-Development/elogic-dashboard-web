import { Link } from '@tanstack/react-router'
import type { CompanyVitals, VitalMonth } from '@/lib/queries'
import { Sparkline } from './Sparkline'

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[Number(m) - 1] ?? m} ${y}`
}

/**
 * Direction only carries colour where it has an unambiguous meaning. Logged
 * hours going down can be a smaller month or a smaller team; participation and
 * coverage going down is bad in every reading, so those two are coloured.
 */
type Direction = 'up_good' | 'up_bad' | 'neutral'

function Delta({
  from,
  to,
  direction,
  suffix,
  integer = false,
}: {
  from: number | null
  to: number | null
  direction: Direction
  suffix: string
  /** Counts read as "+1 person", never "+1.0". */
  integer?: boolean
}) {
  if (from == null || to == null) return null
  const diff = to - from
  if (Math.abs(diff) < 0.05) return <span className="text-[11px] text-neutral-400">flat vs prior month</span>
  const good = direction === 'neutral' ? null : direction === 'up_good' ? diff > 0 : diff < 0
  const cls = good === null ? 'text-neutral-500' : good ? 'text-emerald-600' : 'text-red-600'
  const shown = integer || Math.abs(diff) >= 10 ? diff.toFixed(0) : diff.toFixed(1)
  return (
    <span className={`text-[11px] tabular-nums ${cls}`}>
      {diff > 0 ? '+' : ''}
      {shown}
      {suffix} vs prior month
    </span>
  )
}

function Tile({
  label,
  value,
  caption,
  series,
  lastIsPartial,
  delta,
  to,
  footnote,
}: {
  label: string
  value: string
  caption: string
  series?: number[]
  lastIsPartial?: boolean
  delta?: React.ReactNode
  to?: '/projects' | '/people' | '/estimates'
  footnote?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-bold tabular-nums text-neutral-900">{value}</div>
          <div className="text-[11px] text-neutral-500">{caption}</div>
        </div>
        {series && series.length > 1 ? (
          <Sparkline values={series} lastIsPartial={lastIsPartial} title={label} />
        ) : null}
      </div>
      <div className="mt-1.5 text-xs font-medium text-neutral-700">{label}</div>
      {delta ? <div>{delta}</div> : null}
      {footnote ? <div className="mt-1 text-[11px] text-neutral-400">{footnote}</div> : null}
    </>
  )

  const className = 'rounded-lg border border-neutral-200 bg-white px-3 py-2.5'
  if (!to) return <div className={className}>{body}</div>
  return (
    <Link to={to} className={`${className} block transition hover:border-neutral-300 hover:bg-neutral-50`}>
      {body}
    </Link>
  )
}

/**
 * §4.1 bottom block — "Company vitals: four small trend tiles … logged h/wk;
 * active loggers (the participation number that silently fell 74→50);
 * write-off % (AC); estimate coverage of active work (hours-weighted,
 * estimating segments only)."
 *
 * Two deliberate departures, both from what the canonical views can supply:
 * the grain is per **month** (R8's period aggregates are the only canonical
 * series that reach back a year — no weekly view exists), and write-off has no
 * monthly view at all, so that tile shows the current scope split without a
 * trend. Both are recorded as F3 deviations in docs/progress-log.md.
 */
export function VitalsTiles({
  vitals,
  loading,
  error,
}: {
  vitals: CompanyVitals | null
  loading: boolean
  error?: string
}) {
  if (!loading && error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span className="font-medium">Company vitals could not be loaded.</span>{' '}
        <code className="text-xs">{error}</code>
      </div>
    )
  }

  if (loading || !vitals) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
        Loading company vitals…
      </div>
    )
  }

  const months = vitals.months
  // The month in progress is always partial; the headline reads the last
  // complete one so the tile never says "hours collapsed" on the 3rd.
  const complete: VitalMonth[] = months.filter((m) => m.month !== vitals.current_month)
  const last = complete[complete.length - 1] ?? null
  const prior = complete[complete.length - 2] ?? null
  const partial = months.find((m) => m.month === vitals.current_month) ?? null

  const hoursSeries = months.map((m) => m.logged_hours)
  const loggerSeries = months.map((m) => m.active_loggers)
  const coverageSeries = months.map((m) => m.coverage_pct ?? 0)

  const monthCaption = last ? `${monthLabel(last.month)} · last complete month` : '—'

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Hours logged, in scope"
        value={last ? `${Math.round(last.logged_hours).toLocaleString()}h` : '—'}
        caption={monthCaption}
        series={hoursSeries}
        lastIsPartial={partial !== null}
        delta={<Delta from={prior?.logged_hours ?? null} to={last?.logged_hours ?? null} direction="neutral" suffix="h" />}
        to="/projects"
        footnote={partial ? `${Math.round(partial.logged_hours).toLocaleString()}h so far in ${monthLabel(partial.month)}` : undefined}
      />
      <Tile
        label="Active loggers"
        value={last ? String(last.active_loggers) : '—'}
        caption={monthCaption}
        series={loggerSeries}
        lastIsPartial={partial !== null}
        delta={
          <Delta
            from={prior?.active_loggers ?? null}
            to={last?.active_loggers ?? null}
            direction="up_good"
            suffix=" people"
            integer
          />
        }
        to="/people"
        footnote="People logging any in-scope hours that month — participation, not headcount."
      />
      <Tile
        label="Write-off, in scope"
        value={vitals.writeoff_pct_in_scope == null ? '—' : `${vitals.writeoff_pct_in_scope.toFixed(1)}%`}
        caption={`company ${vitals.writeoff_pct_company == null ? '—' : `${vitals.writeoff_pct_company.toFixed(1)}%`} · all time since 2025`}
        footnote={`ActiveCollab only — ${Math.round(vitals.untagged_hours_in_scope).toLocaleString()}h of in-scope Jira time carries no billable flag. No monthly write-off view exists yet, so this tile has no trend.`}
      />
      <Tile
        label="Estimate coverage of active work"
        value={last?.coverage_pct == null ? '—' : `${last.coverage_pct.toFixed(0)}%`}
        caption={monthCaption}
        series={coverageSeries}
        lastIsPartial={partial !== null}
        delta={<Delta from={prior?.coverage_pct ?? null} to={last?.coverage_pct ?? null} direction="up_good" suffix="pts" />}
        to="/estimates"
        footnote="Hours-weighted, fixed-scope + maintenance only. T&M and internal work has no estimates by design."
      />
    </div>
  )
}
