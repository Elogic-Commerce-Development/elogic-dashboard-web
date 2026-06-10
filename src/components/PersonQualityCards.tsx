import { Fragment, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import type { ContributorTaskSummary } from '@/lib/queries'

/**
 * Per-person quality row for the contributor detail page: the projects the
 * person worked on in the selected period (as links, where the WFH card used
 * to sit) plus Bugs Rate and Return Rate computed over the period task list.
 * Rendered for everyone — unlike the utilization cards it does not depend on
 * a PeopleForce link.
 */
export function PersonQualityCards({ tasks }: { tasks: ContributorTaskSummary[] }) {
  const { projects, bugs, iterations } = useMemo(() => {
    const projectMap = new Map<number, string>()
    let bugsSum = 0
    let bugsN = 0
    let iterSum = 0
    let iterN = 0
    for (const t of tasks) {
      if (!projectMap.has(t.project_id)) projectMap.set(t.project_id, t.project_name)
      if (t.qa_bugs != null) {
        bugsSum += Number(t.qa_bugs)
        bugsN++
      }
      if (t.qa_iterations != null) {
        iterSum += Number(t.qa_iterations)
        iterN++
      }
    }
    return {
      projects: Array.from(projectMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      bugs: { avg: bugsN > 0 ? bugsSum / bugsN : null, n: bugsN },
      iterations: { avg: iterN > 0 ? iterSum / iterN : null, n: iterN },
    }
  }, [tasks])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm sm:col-span-2">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500">Projects (in period)</div>
        {projects.length === 0 ? (
          <div className="mt-0.5 text-xl font-semibold text-neutral-900">—</div>
        ) : (
          <div className="mt-1 text-sm leading-relaxed text-neutral-900">
            {projects.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 && <span className="text-neutral-400">, </span>}
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: String(p.id) }}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {p.name}
                </Link>
              </Fragment>
            ))}
          </div>
        )}
      </div>

      <RateCard label="Bugs Rate" avg={bugs.avg} n={bugs.n} kind="bugs" />
      <RateCard label="Return Rate" avg={iterations.avg} n={iterations.n} kind="iterations" />
    </div>
  )
}

function RateCard({
  label,
  avg,
  n,
  kind,
}: {
  label: string
  avg: number | null
  n: number
  kind: 'bugs' | 'iterations'
}) {
  const warn = avg != null && (kind === 'bugs' ? avg > 0 : avg > 1)
  const bad = avg != null && avg > 2
  const tone = bad
    ? 'border-red-200 bg-red-50'
    : warn
      ? 'border-amber-200 bg-amber-50'
      : 'border-neutral-200 bg-white'
  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tone}`}>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-neutral-900 tabular-nums">
        {avg == null ? '—' : avg.toFixed(1)}
      </div>
      <div className="text-xs text-neutral-500">
        {n === 0 ? 'no QA-labeled tasks in period' : `avg over ${n} labeled task${n === 1 ? '' : 's'}`}
      </div>
    </div>
  )
}
