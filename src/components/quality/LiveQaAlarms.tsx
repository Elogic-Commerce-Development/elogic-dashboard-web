import { Link } from '@tanstack/react-router'
import { SourceBadge } from '@/components/SourceBadge'
import type { SecondRoundTask } from '@/lib/queries'
import { externalTaskLink, formatHours, formatQa } from '@/lib/format'

/**
 * §4.3's live alarms: "open tasks entering their 2nd+ QA round (feeds Radar)".
 *
 * The parenthetical is the design: this is the same `is_second_qa_round`
 * predicate Radar already fires a project-level signal on, shown here at task
 * grain so the signal has somewhere to land. Radar answers *which project*;
 * this answers *which ticket, and how long it has been sitting*.
 *
 * Sorted by iteration count then hours burned — the ticket on its fourth round
 * with 40h in it is a different conversation from the one that just came back
 * once, and sorting by recency would bury it.
 */
export function LiveQaAlarms({ tasks }: { tasks: SecondRoundTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-neutral-500">
        No open task is on a 2nd+ QA round. On this page that is the healthy
        state — and it is a real zero, measured over every in-scope open task.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {tasks.map((t) => {
        const link = externalTaskLink({
          source: t.source,
          projectId: t.project_id,
          taskId: t.task_id,
          taskJiraKey: t.task_jira_key,
        })
        const overEstimate =
          t.estimate_hours != null && t.estimate_hours > 0 && t.actual_hours > t.estimate_hours
        return (
          <li key={t.task_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                t.qa_iterations >= 3
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
              title={
                t.qa_iterations_capped
                  ? `${t.qa_iterations} or more QA iterations recorded (capped upstream)`
                  : `${t.qa_iterations} QA iterations recorded`
              }
            >
              {formatQa(t.qa_iterations, t.qa_iterations_capped)} rounds
            </span>

            <Link
              to="/tasks/$taskId"
              params={{ taskId: String(t.task_id) }}
              className="min-w-0 flex-1 truncate font-medium text-blue-600 hover:text-blue-800 hover:underline"
              title={t.task_name}
            >
              {t.task_name}
            </Link>

            <SourceBadge source={t.source} />

            <Link
              to="/projects/$projectId"
              params={{ projectId: String(t.project_id) }}
              className="shrink-0 text-xs text-neutral-500 hover:text-blue-600 hover:underline"
            >
              {t.project_name}
            </Link>

            <span className="shrink-0 tabular-nums text-xs text-neutral-600">
              <span className={overEstimate ? 'font-medium text-red-600' : ''}>
                {formatHours(t.actual_hours)}
              </span>
              {t.estimate_hours != null && t.estimate_hours > 0
                ? ` / ${formatHours(t.estimate_hours)} est`
                : ' · unestimated'}
            </span>

            {t.qa_bugs != null ? (
              <span
                className="shrink-0 text-xs text-neutral-500"
                title={
                  t.qa_bugs_capped
                    ? `${t.qa_bugs} or more bugs found (capped upstream)`
                    : `${t.qa_bugs} bugs found`
                }
              >
                {formatQa(t.qa_bugs, t.qa_bugs_capped)} bugs
              </span>
            ) : null}

            <span
              className={`shrink-0 text-xs tabular-nums ${
                t.days_since_time != null && t.days_since_time >= 14
                  ? 'text-red-600'
                  : 'text-neutral-400'
              }`}
              title={t.last_time_on ? `Last time logged ${t.last_time_on}` : 'No time logged'}
            >
              {t.days_since_time == null ? 'no time' : `${t.days_since_time}d idle`}
            </span>

            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[11px] text-neutral-400 hover:text-blue-600"
              title={link.label}
            >
              ↗
            </a>
          </li>
        )
      })}
    </ul>
  )
}
