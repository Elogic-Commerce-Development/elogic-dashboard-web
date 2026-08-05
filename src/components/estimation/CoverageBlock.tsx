import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { SourceBadge } from '@/components/SourceBadge'
import { formatHours } from '@/lib/format'
import { coverageTone, formatPct, segmentLabel } from '@/lib/estimation'
import type {
  CoverageMonth,
  PersonCoverageRow,
  ProjectCoverageRow,
  SegmentCoverage,
  UnassignedBucket,
} from '@/lib/queries'
import { CoverageTrendChart } from './CoverageTrendChart'
import { Block, Chip, LoadFailure, Loading, Panel, StatTile } from './Section'

/** How many people the unestimated list shows before "show all". */
const PERSON_ROWS = 15

export type CoverageData = {
  segments: SegmentCoverage[]
  trend: CoverageMonth[]
  projects: ProjectCoverageRow[]
  people: PersonCoverageRow[]
  unassigned: UnassignedBucket | null
}

type Totals = {
  tasks: number
  estimated_tasks: number
  hours: number
  estimated_hours: number
  unestimated_hours: number
  coverage_pct: number | null
  adoption_pct: number | null
}

function totalOf(segments: SegmentCoverage[]): Totals {
  const t = segments.reduce(
    (acc, s) => ({
      tasks: acc.tasks + s.tasks,
      estimated_tasks: acc.estimated_tasks + s.estimated_tasks,
      hours: acc.hours + s.hours,
      estimated_hours: acc.estimated_hours + s.estimated_hours,
      unestimated_hours: acc.unestimated_hours + s.unestimated_hours,
    }),
    { tasks: 0, estimated_tasks: 0, hours: 0, estimated_hours: 0, unestimated_hours: 0 },
  )
  return {
    ...t,
    coverage_pct: t.hours > 0 ? (t.estimated_hours / t.hours) * 100 : null,
    adoption_pct: t.tasks > 0 ? (t.estimated_tasks / t.tasks) * 100 : null,
  }
}

const PROJECT_COLUMNS: ColumnDef<ProjectCoverageRow>[] = [
  {
    accessorKey: 'project_name',
    header: 'Project',
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Link
          to="/projects/$projectId"
          params={{ projectId: String(row.original.project_id) }}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {row.original.project_name}
        </Link>
        <SourceBadge source={row.original.source} />
      </div>
    ),
  },
  {
    accessorKey: 'work_model',
    header: 'Segment',
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Chip>{segmentLabel(row.original.work_model)}</Chip>
        {row.original.rate_band ? (
          <Chip title="Rate band — ranking weight only, never money">
            {row.original.rate_band}
          </Chip>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: 'unestimated_hours',
    header: 'Unestimated hours',
    cell: ({ getValue }) => (
      <span className="font-semibold tabular-nums text-red-600">
        {formatHours(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'hours',
    header: 'Total hours',
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatHours(Number(getValue()))}</span>
    ),
  },
  {
    accessorKey: 'coverage_pct',
    header: 'Coverage',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      return <span className={`font-medium tabular-nums ${coverageTone(v)}`}>{formatPct(v)}</span>
    },
  },
  {
    accessorKey: 'tasks',
    header: 'Tasks',
    cell: ({ row }) => (
      <span className="tabular-nums text-neutral-600">
        {row.original.estimated_tasks.toLocaleString()} / {row.original.tasks.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'adoption_pct',
    header: 'Adoption',
    cell: ({ getValue }) => (
      <span className="tabular-nums text-neutral-600">{formatPct(getValue() as number | null)}</span>
    ),
  },
]

const PERSON_COLUMNS: ColumnDef<PersonCoverageRow>[] = [
  {
    accessorKey: 'display_name',
    header: 'Contributor',
    cell: ({ row }) => (
      <Link
        to="/people/$userId"
        params={{ userId: String(row.original.user_id) }}
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        {row.original.display_name}
      </Link>
    ),
  },
  {
    accessorKey: 'unestimated_hours',
    header: 'Hours on unestimated work',
    cell: ({ getValue }) => (
      <span className="font-semibold tabular-nums text-red-600">
        {formatHours(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'hours',
    header: 'Total hours',
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatHours(Number(getValue()))}</span>
    ),
  },
  {
    accessorKey: 'coverage_pct',
    header: 'Coverage',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      return <span className={`font-medium tabular-nums ${coverageTone(v)}`}>{formatPct(v)}</span>
    },
  },
  {
    accessorKey: 'tasks',
    header: 'Tasks touched',
    cell: ({ getValue }) => (
      <span className="tabular-nums text-neutral-600">{Number(getValue()).toLocaleString()}</span>
    ),
  },
]

/**
 * §4.2's coverage block — the headline, and deliberately first.
 *
 * The plan's finding is that unestimated work is a bigger story than
 * mis-estimated work (25,000+ unpriced hours against ~1,900h of measured
 * overrun), so this block answers "how much of the work has no price at all"
 * before the calibration block asks "and were the prices right".
 */
export function CoverageBlock({
  data,
  loading,
  error,
}: {
  data: CoverageData
  loading: boolean
  error?: string
}) {
  const [allPeople, setAllPeople] = useState(false)
  const totals = useMemo(() => totalOf(data.segments), [data.segments])

  const people = allPeople ? data.people : data.people.slice(0, PERSON_ROWS)
  const hiddenPeople = data.people.length - people.length

  return (
    <Block
      title="Coverage — is the work priced at all?"
      blurb="Hours-weighted, because a task-count adoption rate treats a 2-hour ticket and a 200-hour
        rebuild as one vote each. Coverage is hours logged against estimated tasks ÷ all task-linked
        hours, over tasks created since 2025-01-01 on fixed-scope and maintenance projects."
    >
      {loading ? (
        <Loading what="coverage" />
      ) : error ? (
        <LoadFailure what="Coverage" error={error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Unestimated hours"
              value={`${Math.round(totals.unestimated_hours).toLocaleString()}h`}
              tone="red"
              emphasis
              caption={
                totals.hours > 0
                  ? `${formatPct(100 - (totals.coverage_pct ?? 0))} of the ${Math.round(
                      totals.hours,
                    ).toLocaleString()}h logged here carries no estimate`
                  : undefined
              }
            />
            <StatTile
              label="Estimate coverage"
              value={formatPct(totals.coverage_pct)}
              tone={
                totals.coverage_pct == null
                  ? 'neutral'
                  : totals.coverage_pct >= 60
                    ? 'emerald'
                    : totals.coverage_pct >= 30
                      ? 'amber'
                      : 'red'
              }
              caption={`${Math.round(totals.estimated_hours).toLocaleString()}h on estimated tasks`}
            />
            <StatTile
              label="Estimate adoption"
              value={formatPct(totals.adoption_pct)}
              caption={`${totals.estimated_tasks.toLocaleString()} of ${totals.tasks.toLocaleString()} tasks carry an estimate — the count-based view, shown second on purpose`}
            />
            <StatTile
              label="Projects in this scope"
              value={String(data.projects.length)}
              caption={data.segments
                .map((s) => `${segmentLabel(s.work_model)} ${formatPct(s.coverage_pct)}`)
                .join(' · ')}
            />
          </div>

          <Panel
            title="Unestimated hours by month"
            blurb="Hours logged per calendar month, split by whether the task they landed on carries an estimate. The line is coverage."
            meta={`${data.trend.length} months`}
          >
            <CoverageTrendChart months={data.trend} />
          </Panel>

          <Panel
            title="Coverage by project"
            blurb="Sorted by the size of the unpriced pile — the biggest number is the first conversation to have."
            meta={`${data.projects.length} projects`}
          >
            <DataTable
              data={data.projects}
              columns={PROJECT_COLUMNS}
              emptyText="No estimating-segment project carries 2025+ hours."
            />
          </Panel>

          <Panel
            title="Hours on unestimated work, by person"
            blurb="Whose hours went onto unpriced tasks, inside estimating projects only. This is contribution, not blame for the missing estimate — see the note below."
            meta={`${data.people.length} contributors`}
          >
            <DataTable
              data={people}
              columns={PERSON_COLUMNS}
              emptyText="No contributor logged hours in the estimating segments."
            />
            {hiddenPeople > 0 && (
              <button
                type="button"
                onClick={() => setAllPeople(true)}
                className="w-full border-t border-neutral-200 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-neutral-50"
              >
                +{hiddenPeople} more below the top {PERSON_ROWS} — show all
              </button>
            )}
            {allPeople && data.people.length > PERSON_ROWS && (
              <button
                type="button"
                onClick={() => setAllPeople(false)}
                className="w-full border-t border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
              >
                Show the top {PERSON_ROWS} only
              </button>
            )}
            <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[11px] leading-relaxed text-neutral-600">
              <p>
                <span className="font-semibold text-neutral-800">Unassigned:</span>{' '}
                {data.unassigned == null ? (
                  <span className="text-neutral-400">not measured</span>
                ) : (
                  <>
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {data.unassigned.tasks.toLocaleString()} tasks
                    </span>{' '}
                    /{' '}
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {formatHours(data.unassigned.hours)}
                    </span>{' '}
                    in these segments have no assignee of record, {formatHours(data.unassigned.unestimated_hours)}{' '}
                    of it unestimated. Those hours are already counted above under whoever logged
                    them — this row is the separate fact that for that share of the work there is
                    nobody to ask about the missing estimate.
                  </>
                )}
              </p>
              <p className="mt-1.5">
                Nobody is “the person who skipped the estimate”: <code>delegated_by_id</code> is
                100% null in scope, so who created a task without an estimate is not recorded. Read
                this list as where unpriced effort accumulates, not as an accountability ranking —
                the top rows are delivery and QA engineers, and the recurring test containers two of
                them carry are genuinely hard to estimate per task.
              </p>
            </div>
          </Panel>
        </>
      )}
    </Block>
  )
}
