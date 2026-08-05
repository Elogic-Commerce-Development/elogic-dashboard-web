import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { BleedingTask } from '@/lib/queries'
import { QUEUE_TOP_N } from '@/lib/radarPolicy'
import { SourceBadge } from '@/components/SourceBadge'
import { formatHours, externalTaskLink } from '@/lib/format'

/**
 * §4.1 ranks both live lists "by excess hours × rate band" — the same
 * hours-weighted-by-band logic the attention queue uses, so a task bleeding on
 * an A-band engagement outranks a bigger overrun on a C-band one.
 *
 * The approaching list has no excess yet by definition, so its hours-at-risk
 * is the burn so far (what `v_metric_project_signals.approaching_hours`
 * contributes to that project's exposure). Recorded as an F3 decision.
 */
function rankValue(t: BleedingTask, kind: ListKind): number {
  const hours = kind === 'burning' ? t.overrun_live_hours : t.actual_hours
  return hours * t.rate_band_weight
}

type ListKind = 'burning' | 'approaching'

function lastActivity(t: BleedingTask): { text: string; stale: boolean } {
  if (!t.last_time_on) return { text: 'never', stale: true }
  const days = t.days_since_time
  if (days == null) return { text: t.last_time_on, stale: false }
  const text = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`
  return { text, stale: days > 14 }
}

function TaskRows({
  tasks,
  kind,
  assignees,
}: {
  tasks: BleedingTask[]
  kind: ListKind
  assignees: Map<number, string>
}) {
  return (
    <tbody className="divide-y divide-neutral-100">
      {tasks.map((t) => {
        const link = externalTaskLink({
          source: t.source,
          projectId: t.project_id,
          taskId: t.task_id,
          taskJiraKey: t.task_jira_key,
        })
        const act = lastActivity(t)
        const consumedPct = t.consumption == null ? null : Math.round(t.consumption * 100)
        return (
          <tr key={t.task_id} className="align-top">
            <td className="px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId: String(t.task_id) }}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {t.task_name}
                </Link>
                <SourceBadge source={t.source} />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  title={link.label}
                  className="shrink-0 text-[11px] text-neutral-400 hover:text-blue-600"
                >
                  ↗
                </a>
              </div>
              <div className="text-[11px] text-neutral-500">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: String(t.project_id) }}
                  className="hover:text-blue-600 hover:underline"
                >
                  {t.project_name}
                </Link>
                {' · band '}
                {t.rate_band ?? '—'}
                {t.assignee_id != null && assignees.get(t.assignee_id)
                  ? ` · ${assignees.get(t.assignee_id)}`
                  : ' · unassigned'}
              </div>
            </td>
            <td className="px-3 py-2 text-right text-xs tabular-nums text-neutral-600">
              {formatHours(t.estimate_hours)}
            </td>
            <td className="px-3 py-2 text-right text-xs tabular-nums text-neutral-900">
              {formatHours(t.actual_hours)}
            </td>
            <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
              {kind === 'burning' ? (
                <span className="text-red-600">+{formatHours(t.overrun_live_hours)}</span>
              ) : (
                <span className="text-amber-600">{consumedPct == null ? '—' : `${consumedPct}%`}</span>
              )}
            </td>
            <td
              className={`px-3 py-2 text-right text-xs tabular-nums ${
                act.stale ? 'text-neutral-400' : 'text-neutral-600'
              }`}
            >
              {act.text}
            </td>
          </tr>
        )
      })}
    </tbody>
  )
}

function BleedingList({
  title,
  blurb,
  tasks,
  kind,
  assignees,
  loading,
  emptyText,
  error,
}: {
  title: string
  blurb: string
  tasks: BleedingTask[]
  kind: ListKind
  assignees: Map<number, string>
  loading: boolean
  emptyText: string
  /** Set when this list's query failed — must not render as "nothing here". */
  error?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const ranked = [...tasks].sort(
    (a, b) => rankValue(b, kind) - rankValue(a, kind) || a.task_id - b.task_id,
  )
  const visible = expanded ? ranked : ranked.slice(0, QUEUE_TOP_N)
  const overflow = ranked.length - visible.length

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-200 px-3 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="text-xs text-neutral-500">{blurb}</p>
        </div>
        <span className="text-xs tabular-nums text-neutral-500">
          {error ? '—' : `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
        </span>
      </header>

      {loading ? (
        <p className="px-3 py-6 text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        <p className="px-3 py-6 text-sm text-red-700">
          <span className="font-medium">This list could not be loaded.</span> Not an all-clear —
          nothing was evaluated. <code className="text-xs">{error}</code>
        </p>
      ) : ranked.length === 0 ? (
        <p className="px-3 py-6 text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-1.5 text-left font-medium">Task</th>
                <th className="px-3 py-1.5 text-right font-medium">Est.</th>
                <th className="px-3 py-1.5 text-right font-medium">Burn</th>
                <th className="px-3 py-1.5 text-right font-medium">
                  {kind === 'burning' ? 'Excess' : 'Consumed'}
                </th>
                <th className="px-3 py-1.5 text-right font-medium">Last</th>
              </tr>
            </thead>
            <TaskRows tasks={visible} kind={kind} assignees={assignees} />
          </table>
          {overflow > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full border-t border-neutral-200 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-neutral-50"
            >
              +{overflow} more below the top {QUEUE_TOP_N} — show all
            </button>
          )}
          {expanded && ranked.length > QUEUE_TOP_N && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full border-t border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
            >
              Show the top {QUEUE_TOP_N} only
            </button>
          )}
        </>
      )}
    </section>
  )
}

/**
 * §4.1 middle block — "the two live task lists (over-estimate & burning;
 * 80–100% consumed) … each row with estimate, burn, last activity, owner,
 * source link".
 *
 * Assignee is shown as display metadata only; §5 is explicit that
 * assignee-of-record is never attribution.
 */
export function BleedingNow({
  burning,
  approaching,
  assignees,
  loading,
  burningError,
  approachingError,
}: {
  burning: BleedingTask[]
  approaching: BleedingTask[]
  assignees: Map<number, string>
  loading: boolean
  burningError?: string
  approachingError?: string
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <BleedingList
        title="Over estimate & still burning"
        blurb="Open tasks past their estimate with time logged in the last 14 days — §1.2's strongest early-warning signal, filtered to the part still moving."
        tasks={burning}
        kind="burning"
        assignees={assignees}
        loading={loading}
        error={burningError}
        emptyText="Nothing open is past estimate and still burning."
      />
      <BleedingList
        title="Approaching estimate (80–100%)"
        blurb="Open tasks that have consumed 80–100% of their estimate and have not crossed yet. Median lead time after crossing is 4 days."
        tasks={approaching}
        kind="approaching"
        assignees={assignees}
        loading={loading}
        error={approachingError}
        emptyText="No open task is inside the 80–100% band."
      />
    </div>
  )
}
