import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { SourceBadge } from '@/components/SourceBadge'
import { Chip } from '@/components/estimation/Section'
import type { ReturnedRateRow } from '@/lib/queries'
import { formatPct } from '@/lib/quality'
import {
  QUALITY_TABLE_TOP_N,
  qaCoverageTone,
  returnedRateTone,
  type QaTone,
} from '@/lib/qualityPolicy'
import { workModelLabel } from '@/lib/writeoffPolicy'

const TONE_CLASS: Record<QaTone, string> = {
  red: 'text-red-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  neutral: 'text-neutral-400',
}

function columns(minSample: number): ColumnDef<ReturnedRateRow>[] {
  return [
    {
      id: 'project',
      header: 'Project',
      accessorFn: (r) => r.project_name,
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
          <Chip>{workModelLabel(row.original.work_model)}</Chip>
        </div>
      ),
    },
    {
      id: 'completed',
      header: 'Completed',
      accessorFn: (r) => r.completed_tasks,
      cell: ({ row }) => (
        <span className="tabular-nums text-neutral-700">{row.original.completed_tasks}</span>
      ),
    },
    {
      id: 'coverage',
      header: 'QA coverage',
      accessorFn: (r) => r.qa_coverage_pct ?? -1,
      cell: ({ row }) => {
        const r = row.original
        return (
          <span className="tabular-nums">
            <span className={`font-medium ${TONE_CLASS[qaCoverageTone(r.qa_coverage_pct)]}`}>
              {formatPct(r.qa_coverage_pct)}
            </span>{' '}
            <span className="text-[11px] text-neutral-400">
              ({r.qa_covered_tasks}/{r.completed_tasks})
            </span>
          </span>
        )
      },
    },
    {
      id: 'returned',
      header: 'Returned rate',
      accessorFn: (r) => r.returned_pct ?? -1,
      cell: ({ row }) => {
        const r = row.original
        // §4.3 asks for the rate "with n", and §4.5's floor is the house rule
        // for what n is enough. Below it the row still renders — the project
        // has not vanished — but the percentage does not, because 1 return out
        // of 3 labelled tickets is not a 33% returned rate, it is noise.
        if (r.qa_covered_tasks < minSample) {
          return (
            <span
              className="text-xs text-neutral-400"
              title={`Suppressed below n=${minSample} QA-covered completions (${r.qa_covered_tasks} here).`}
            >
              n={r.qa_covered_tasks} — below floor
            </span>
          )
        }
        return (
          <span className="tabular-nums">
            <span className={`font-medium ${TONE_CLASS[returnedRateTone(r.returned_pct)]}`}>
              {formatPct(r.returned_pct)}
            </span>{' '}
            <span className="text-[11px] text-neutral-400">
              ({r.returned_tasks}/{r.qa_covered_tasks})
            </span>
          </span>
        )
      },
    },
    {
      id: 'open_second',
      header: 'Open 2nd+ round',
      accessorFn: (r) => r.open_second_qa_round,
      cell: ({ row }) => {
        const n = row.original.open_second_qa_round
        if (n === 0) return <span className="text-neutral-300">—</span>
        return <span className="font-medium tabular-nums text-amber-600">{n}</span>
      },
    },
    {
      id: 'ladder',
      header: 'Avg actual by round (1 · 2 · 3+)',
      accessorFn: (r) => r.avg_hours_iter_3plus ?? -1,
      cell: ({ row }) => {
        const r = row.original
        const cell = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}h`)
        return (
          <span className="tabular-nums text-xs text-neutral-600">
            {cell(r.avg_hours_iter_1)} · {cell(r.avg_hours_iter_2)} ·{' '}
            <span className={r.avg_hours_iter_3plus != null ? 'font-medium text-red-600' : ''}>
              {cell(r.avg_hours_iter_3plus)}
            </span>
          </span>
        )
      },
    },
  ]
}

/**
 * §4.3's coverage scoreboard: "% of completed tasks carrying qa_iterations per
 * project — **makes the AC blind spot (4%) itself a managed number**".
 *
 * That is why coverage is a first-class column beside the returned rate rather
 * than a footnote: a project at 0% coverage has no quality signal at all, and
 * the honest rendering of that is a visible zero in a column someone owns, not
 * an absent row.
 *
 * Rows with no completed task at all are dropped — they are not a coverage
 * failure, they are a project that has not finished anything in scope yet.
 */
export function CoverageScoreboard({
  rows,
  minSample,
}: {
  rows: ReturnedRateRow[]
  minSample: number
}) {
  const [showAll, setShowAll] = useState(false)
  const withWork = useMemo(() => rows.filter((r) => r.completed_tasks > 0), [rows])
  const visible = showAll ? withWork : withWork.slice(0, QUALITY_TABLE_TOP_N)
  const cols = useMemo(() => columns(minSample), [minSample])

  return (
    <div className="space-y-2">
      <DataTable
        data={visible}
        columns={cols}
        emptyText="No in-scope project has completed a task yet."
      />
      {withWork.length > QUALITY_TABLE_TOP_N ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {showAll
            ? `Show top ${QUALITY_TABLE_TOP_N}`
            : `Show all ${withWork.length} projects`}
        </button>
      ) : null}
    </div>
  )
}
