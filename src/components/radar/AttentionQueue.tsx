import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { RadarQueueRow, ProjectMonthHours } from '@/lib/queries'
import { firingSignals, WORK_MODEL_LABEL, type SignalTone } from '@/lib/radarSignals'
import { QUEUE_TOP_N } from '@/lib/radarPolicy'
import { SourceBadge } from '@/components/SourceBadge'
import { Sparkline } from './Sparkline'
import { formatHours } from '@/lib/format'

const toneClass: Record<SignalTone, string> = {
  red: 'bg-red-50 text-red-800 ring-red-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide text-neutral-600"
    >
      {children}
    </span>
  )
}

function QueueRow({
  row,
  rank,
  series,
}: {
  row: RadarQueueRow
  rank: number
  series: ProjectMonthHours[]
}) {
  const signals = firingSignals(row)
  const values = series.map((s) => s.hours)
  const span = series.length > 0 ? `${series[0].month.slice(0, 7)} → ${series[series.length - 1].month.slice(0, 7)}` : ''

  return (
    <li className="flex gap-3 px-4 py-3">
      <div className="w-5 shrink-0 pt-0.5 text-right text-xs tabular-nums text-neutral-400">{rank}</div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(row.project_id) }}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.project_name}
          </Link>
          <SourceBadge source={row.source} />
          <Chip title="§5 work-model segment">{WORK_MODEL_LABEL[row.work_model] ?? row.work_model}</Chip>
          <Chip
            title={`Rate band ${row.rate_band ?? 'untagged'} — ordinal ranking weight ${row.rate_band_weight}. Ranking only, never money (§5).`}
          >
            Band {row.rate_band ?? '—'}
          </Chip>
          <span className="text-[11px] text-neutral-400">
            {formatHours(row.exposure_hours)} at risk across {signals.length}{' '}
            {signals.length === 1 ? 'signal' : 'signals'}
          </span>
        </div>

        <ul className="mt-1.5 space-y-1">
          {signals.map((s) => (
            <li key={s.key} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ring-1 ring-inset ${toneClass[s.tone]}`}
              >
                {s.label}
              </span>
              <span className="text-neutral-600">{s.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 pt-0.5 sm:flex">
        <Sparkline
          values={values}
          tone="neutral"
          lastIsPartial
          title={`Hours logged per month, ${span} (current month partial)`}
        />
        <Link
          to="/projects/$projectId"
          params={{ projectId: String(row.project_id) }}
          className="text-[11px] text-neutral-400 hover:text-blue-600 hover:underline"
        >
          detail →
        </Link>
      </div>
    </li>
  )
}

/**
 * §4.1 top block — "active projects ranked by exposure, displayed as named
 * firing signals, never an opaque score".
 *
 * The order comes from `v_metric_exposure.exposure_score` (Σ hours-at-risk over
 * the firing signals × rate band) and the score itself is never printed: the
 * hours beside each signal are what explain the position. Ranking by signal
 * count was explicitly rejected — a project bleeding at our lowest rate would
 * outrank one bleeding at our highest.
 */
export function AttentionQueue({
  rows,
  series,
  loading,
  error,
  untaggedActiveProjects,
}: {
  rows: RadarQueueRow[]
  series: Map<number, ProjectMonthHours[]>
  loading: boolean
  /** Set when the queue query failed — must never read as "nothing to triage". */
  error?: string
  untaggedActiveProjects: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rows : rows.slice(0, QUEUE_TOP_N)
  const overflow = rows.length - visible.length

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Attention queue</h2>
          <p className="text-xs text-neutral-500">
            In-scope projects with at least one firing signal, ranked by exposure — hours at risk
            weighted by rate band, not by how many signals fired.
          </p>
        </div>
        <span className="text-xs tabular-nums text-neutral-500">
          {error ? '—' : `${rows.length} ${rows.length === 1 ? 'project' : 'projects'}`}
        </span>
      </header>

      {untaggedActiveProjects > 0 && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <span className="font-medium">
            {untaggedActiveProjects} active {untaggedActiveProjects === 1 ? 'project has' : 'projects have'} no
            work-model tag.
          </span>{' '}
          Untagged projects rank at the lowest band and are excluded from the estimating segments —
          tag them in the backend (<code>projects:classify</code>) or their signals under-read.
        </p>
      )}

      {loading ? (
        <p className="px-4 py-6 text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        // Silence here would be indistinguishable from "all clear" on a page
        // whose entire job is to warn. A failed queue says so, loudly.
        <p className="px-4 py-6 text-sm text-red-700">
          <span className="font-medium">The attention queue could not be loaded.</span> This is not
          an all-clear — no signal was evaluated. Reload; if it persists, the error was:{' '}
          <code className="text-xs">{error}</code>
        </p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">
          No project is firing a signal. That is the healthy state — nothing to triage today.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100">
            {visible.map((row, i) => (
              <QueueRow
                key={row.project_id}
                row={row}
                rank={i + 1}
                series={series.get(row.project_id) ?? []}
              />
            ))}
          </ul>
          {overflow > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full border-t border-neutral-200 px-4 py-2 text-xs font-medium text-blue-600 hover:bg-neutral-50"
            >
              +{overflow} more {overflow === 1 ? 'project' : 'projects'} below the top {QUEUE_TOP_N} — show all
            </button>
          )}
          {expanded && rows.length > QUEUE_TOP_N && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full border-t border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
            >
              Show the top {QUEUE_TOP_N} only
            </button>
          )}
        </>
      )}
    </section>
  )
}
