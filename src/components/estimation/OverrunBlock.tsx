import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { SourceBadge } from '@/components/SourceBadge'
import { externalTaskLink, formatDate, formatHours } from '@/lib/format'
import { concentration, formatPct, formatRatioX, segmentLabel } from '@/lib/estimation'
import type { BlowoutTask, PersonOverrunRow, ProjectOverrunRow } from '@/lib/queries'
import { Block, Chip, LoadFailure, Loading, Panel, StatTile } from './Section'

/**
 * §4.2 asks for "the top-30 blowout queue (42% of overrun hours) as a
 * reviewable list". 30 is a review-meeting length, not a threshold — changing
 * it moves no number, which is why it lives here and not in `v_metric_config`.
 */
const BLOWOUT_TOP_N = 30

export type OverrunData = {
  projects: ProjectOverrunRow[]
  people: PersonOverrunRow[]
  tasks: BlowoutTask[]
}

const TASK_COLUMNS: ColumnDef<BlowoutTask>[] = [
  {
    accessorKey: 'task_name',
    header: 'Task',
    cell: ({ row }) => {
      const t = row.original
      const link = externalTaskLink({
        source: t.source,
        projectId: t.project_id,
        taskId: t.task_id,
        taskJiraKey: t.task_jira_key,
      })
      return (
        <div className="min-w-0">
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
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(t.project_id) }}
            className="text-[11px] text-neutral-500 hover:text-blue-600 hover:underline"
          >
            {t.project_name}
          </Link>
        </div>
      )
    },
  },
  {
    accessorKey: 'estimate_hours',
    header: 'Estimate',
    cell: ({ getValue }) => (
      <span className="tabular-nums text-neutral-600">{formatHours(Number(getValue()))}</span>
    ),
  },
  {
    accessorKey: 'actual_hours',
    header: 'Actual',
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatHours(Number(getValue()))}</span>
    ),
  },
  {
    accessorKey: 'overrun_hours',
    header: 'Excess',
    cell: ({ getValue }) => (
      <span className="font-semibold tabular-nums text-red-600">
        +{formatHours(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'ratio',
    header: 'Ratio',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      const cls = v == null ? '' : v >= 5 ? 'text-red-700' : v >= 2 ? 'text-red-600' : 'text-amber-600'
      return <span className={`font-medium tabular-nums ${cls}`}>{formatRatioX(v)}</span>
    },
  },
  {
    accessorKey: 'completed_on',
    header: 'Completed',
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap tabular-nums text-neutral-500">
        {formatDate(getValue() as string | null)}
      </span>
    ),
  },
]

function projectColumns(total: number): ColumnDef<ProjectOverrunRow>[] {
  return [
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
          <Chip>{segmentLabel(row.original.work_model)}</Chip>
        </div>
      ),
    },
    {
      accessorKey: 'realized_overrun_hours',
      header: 'Overrun hours',
      cell: ({ getValue }) => (
        <span className="font-semibold tabular-nums text-red-600">
          {formatHours(Number(getValue()))}
        </span>
      ),
    },
    {
      accessorKey: 'realized_overrun_tasks',
      header: 'Tasks',
      cell: ({ getValue }) => (
        <span className="tabular-nums text-neutral-600">{Number(getValue()).toLocaleString()}</span>
      ),
    },
    {
      id: 'share',
      header: 'Share',
      accessorFn: (row) => (total > 0 ? (row.realized_overrun_hours / total) * 100 : 0),
      cell: ({ getValue }) => (
        <span className="tabular-nums text-neutral-600">{formatPct(getValue() as number)}</span>
      ),
    },
  ]
}

const PERSON_COLUMNS: ColumnDef<PersonOverrunRow>[] = [
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
    accessorKey: 'realized_overrun_hours',
    header: 'Overrun hours',
    cell: ({ getValue }) => (
      <span className="font-semibold tabular-nums text-red-600">
        {formatHours(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'realized_overrun_tasks',
    header: 'Tasks',
    cell: ({ getValue }) => (
      <span className="tabular-nums text-neutral-600">{Number(getValue()).toLocaleString()}</span>
    ),
  },
]

/**
 * §4.2's overrun economics — the measured-mispricing number, on the work whose
 * bill is already settled.
 *
 * Realized only. Live overrun is Radar's page: it moves daily and carries the
 * bucket exclusion (parity report D3), and putting a moving number beside a
 * settled one under one heading is how a manager ends up quoting the wrong
 * total in a client call.
 */
export function OverrunBlock({
  data,
  loading,
  error,
}: {
  data: OverrunData
  loading: boolean
  error?: string
}) {
  const [allTasks, setAllTasks] = useState(false)

  const totals = useMemo(() => {
    const hours = data.tasks.reduce((s, t) => s + t.overrun_hours, 0)
    const sorted = data.tasks.map((t) => t.overrun_hours)
    return {
      hours,
      tasks: data.tasks.length,
      top10: concentration(sorted, 10),
      top30: concentration(sorted, BLOWOUT_TOP_N),
    }
  }, [data.tasks])

  const projectCols = useMemo(() => projectColumns(totals.hours), [totals.hours])

  const visible = allTasks ? data.tasks : data.tasks.slice(0, BLOWOUT_TOP_N)
  const hidden = data.tasks.length - visible.length
  const attributed = data.people.reduce((s, p) => s + p.realized_overrun_hours, 0)

  return (
    <Block
      title="Overrun economics — what the misprices cost"
      blurb="Realized overrun: Σ max(actual − estimate, 0) over completed estimated tasks. Gross, never
        netted against underruns — netting cancels this to roughly break-even and hides it. Open
        tasks currently over estimate live on Radar, where they can still be acted on."
    >
      {loading ? (
        <Loading what="overrun economics" />
      ) : error ? (
        <LoadFailure what="Overrun economics" error={error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Realized overrun"
              value={`${Math.round(totals.hours).toLocaleString()}h`}
              tone="red"
              emphasis
              caption={`across ${totals.tasks.toLocaleString()} completed tasks that finished over estimate`}
            />
            <StatTile
              label="Top 10 tasks"
              value={formatPct(totals.top10)}
              caption="of all realized overrun hours — the concentration that makes a short review queue worth having"
            />
            <StatTile
              label={`Top ${BLOWOUT_TOP_N} tasks`}
              value={formatPct(totals.top30)}
              caption="of all realized overrun hours: roughly half the pain, in one meeting"
            />
            <StatTile
              label="Attributable to a person"
              value={formatPct(totals.hours > 0 ? (attributed / totals.hours) * 100 : null)}
              caption={`${Math.round(attributed).toLocaleString()}h has a contributor holding ≥ 40% of the task's hours; the rest belongs to the project, not to anyone`}
            />
          </div>

          <Panel
            title="Blowout queue"
            blurb="Every completed task that finished over its estimate, biggest excess first."
            meta={`${data.tasks.length.toLocaleString()} tasks`}
          >
            <DataTable
              data={visible}
              columns={TASK_COLUMNS}
              emptyText="No completed estimated task finished over its estimate."
            />
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setAllTasks(true)}
                className="w-full border-t border-neutral-200 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-neutral-50"
              >
                +{hidden.toLocaleString()} more below the top {BLOWOUT_TOP_N} — show all
              </button>
            )}
            {allTasks && data.tasks.length > BLOWOUT_TOP_N && (
              <button
                type="button"
                onClick={() => setAllTasks(false)}
                className="w-full border-t border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
              >
                Show the top {BLOWOUT_TOP_N} only
              </button>
            )}
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="By project"
              blurb="Where the settled overrun accumulated."
              meta={`${data.projects.length} projects`}
            >
              <DataTable
                data={data.projects}
                columns={projectCols}
                emptyText="No project carries realized overrun."
              />
            </Panel>

            <Panel
              title="By person"
              blurb="Under §5's attribution rule, never the assignee of record."
              meta={`${data.people.length} people`}
            >
              <DataTable
                data={data.people}
                columns={PERSON_COLUMNS}
                emptyText="No overrun is attributable to an individual."
              />
              <p className="border-t border-neutral-100 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
                A task counts against the one contributor who logged at least 40% of its hours; exact
                ties for top stay unattributed, because a sort order must never pick a winner. This
                is why the column does not sum to the headline — the difference is work no single
                person owned. It is also why the old “accuracy by assignee” reading is gone: on the
                tasks that produced it, 85% of the hours belonged to teammates.
              </p>
            </Panel>
          </div>
        </>
      )}
    </Block>
  )
}
