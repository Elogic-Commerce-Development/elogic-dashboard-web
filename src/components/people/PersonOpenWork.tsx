import { Link } from '@tanstack/react-router'
import { Panel } from '@/components/estimation/Section'
import { SourceBadge } from '@/components/SourceBadge'
import { externalTaskLink, formatHours } from '@/lib/format'
import type { PersonOpenTask } from '@/lib/queries'

/**
 * §4.5 person detail: "their current blowouts and stuck tasks, their
 * unestimated worklist".
 *
 * All three are cuts of the same list — every open task §5 attributes to this
 * person — so they cannot disagree about what the person owns, and the page
 * pays `v_metric_tasks`' cost once rather than three times.
 *
 * A task can be both stuck and blowing out; it appears in the first list it
 * qualifies for, in severity order, so the counts sum to the inventory rather
 * than double-counting it.
 */
export function PersonOpenWork({ tasks }: { tasks: PersonOpenTask[] }) {
  const blowouts = tasks.filter((t) => t.is_live_overrun)
  const approaching = tasks.filter((t) => !t.is_live_overrun && t.is_approaching)
  const stuck = tasks.filter((t) => !t.is_live_overrun && !t.is_approaching && t.is_stuck)
  const unestimated = tasks.filter((t) => !t.is_estimated)

  return (
    <Panel
      title="Open work"
      blurb="Tasks still open where this person holds ≥40% of the logged hours — the ones a 1:1 can actually act on."
      meta={`${tasks.length} open`}
    >
      <div className="space-y-4 p-3">
        <Group
          title="Blowing out now"
          hint="Past estimate, still open. Bucket tasks are excluded from this alarm."
          tasks={blowouts}
          empty="Nothing of theirs is over its estimate right now."
          tone="red"
        />
        <Group
          title="Approaching the estimate"
          hint="80–100% of the estimate consumed and still open."
          tasks={approaching}
          empty="Nothing is close to its estimate."
          tone="amber"
        />
        <Group
          title="Stuck"
          hint="Open, estimated, has logged time, but nothing in 14+ days."
          tasks={stuck}
          empty="Nothing of theirs has gone quiet."
          tone="neutral"
        />
        <Group
          title="Unestimated worklist"
          hint="Open tasks they own that carry no estimate at all — the hours here cannot overrun, because there is nothing to overrun."
          tasks={unestimated}
          empty="Every open task they own carries an estimate."
          tone="neutral"
        />
      </div>
    </Panel>
  )
}

function Group({
  title,
  hint,
  tasks,
  empty,
  tone,
}: {
  title: string
  hint: string
  tasks: PersonOpenTask[]
  empty: string
  tone: 'red' | 'amber' | 'neutral'
}) {
  const accent =
    tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-neutral-700'
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          {title}
        </h4>
        <span className={`text-xs font-bold tabular-nums ${accent}`}>{tasks.length}</span>
      </div>
      <p className="mb-1.5 text-[11px] leading-snug text-neutral-500">{hint}</p>
      {tasks.length === 0 ? (
        <p className="text-[11px] italic text-neutral-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
          {tasks.slice(0, 10).map((t) => {
            const ext = externalTaskLink({
              source: t.source,
              projectId: t.project_id,
              taskId: t.task_id,
              taskJiraKey: t.task_jira_key,
            })
            return (
              <li key={t.task_id} className="flex items-baseline gap-2 px-2 py-1.5 text-xs">
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId: String(t.task_id) }}
                  className="min-w-0 flex-1 truncate text-blue-600 hover:underline"
                  title={t.task_name}
                >
                  {t.task_name}
                </Link>
                <SourceBadge source={t.source} />
                <a
                  href={ext.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] text-neutral-400 hover:text-neutral-600"
                  title={ext.label}
                >
                  ↗
                </a>
                <span className="shrink-0 tabular-nums text-neutral-500">
                  {t.estimate_hours == null || t.estimate_hours === 0
                    ? `${formatHours(t.actual_hours)} · no estimate`
                    : `${formatHours(t.actual_hours)} / ${formatHours(t.estimate_hours)}`}
                </span>
                {t.days_since_time != null && t.days_since_time >= 14 && (
                  <span className="shrink-0 text-[10px] text-neutral-400">
                    quiet {t.days_since_time}d
                  </span>
                )}
              </li>
            )
          })}
          {tasks.length > 10 && (
            <li className="px-2 py-1.5 text-[11px] text-neutral-500">
              + {tasks.length - 10} more not listed
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
