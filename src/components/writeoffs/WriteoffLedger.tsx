import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { SourceBadge } from '@/components/SourceBadge'
import { Chip } from '@/components/estimation/Section'
import type { WriteoffProjectRow } from '@/lib/queries'
import { formatHours } from '@/lib/format'
import { LEDGER_TOP_N, workModelLabel } from '@/lib/writeoffPolicy'

const COLUMNS: ColumnDef<WriteoffProjectRow>[] = [
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
        {row.original.is_in_scope ? null : (
          <Chip title="Outside the 65 dashboard-scope delivery projects. Reported because the pinned 8.8% is a company figure — but judged separately.">
            out of scope
          </Chip>
        )}
      </div>
    ),
  },
  {
    id: 'non_billable',
    header: 'Written off',
    accessorFn: (r) => r.non_billable_hours,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums text-neutral-900">
        {formatHours(row.original.non_billable_hours)}
      </span>
    ),
  },
  {
    id: 'billable',
    header: 'Billable',
    accessorFn: (r) => r.billable_hours,
    cell: ({ row }) => (
      <span className="tabular-nums text-neutral-600">
        {formatHours(row.original.billable_hours)}
      </span>
    ),
  },
  {
    id: 'pct',
    header: 'Write-off %',
    accessorFn: (r) => r.writeoff_pct ?? -1,
    cell: ({ row }) => {
      const r = row.original
      // §4.4: Jira carries no billable flag, so its hours are an explicit
      // untagged class — never a 0% write-off, which would read as a project
      // that writes nothing off.
      if (r.writeoff_pct == null) {
        return (
          <span
            className="text-xs text-neutral-400"
            title="No billable-tagged hours on this project. Jira records carry no billable flag (§4.4)."
          >
            untagged
          </span>
        )
      }
      return (
        <span
          className={`tabular-nums ${r.writeoff_flagged ? 'font-semibold text-red-600' : 'text-neutral-700'}`}
          title={r.writeoff_flagged ? 'Flagged by v_metric_config: above the 15% line' : undefined}
        >
          {r.writeoff_pct.toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: 'untagged',
    header: 'Untagged',
    accessorFn: (r) => r.untagged_hours,
    cell: ({ row }) => {
      const h = row.original.untagged_hours
      if (h <= 0) return <span className="text-neutral-300">—</span>
      return (
        <span
          className="tabular-nums text-xs text-indigo-600"
          title="Jira hours: no billable flag exists at source, so these sit outside the denominator rather than being counted as billable."
        >
          {formatHours(h)}
        </span>
      )
    },
  },
]

/**
 * §4.4's ledger: "non-billable hours + share, flagged > 15%".
 *
 * Ordered by **hours**, not by percentage — that ordering is the point of a
 * ledger. "Project Management [Internal]" writes off 99.7% of its time and is
 * an accounting artefact worth 588h; BUFF Maintenance writes off 41.9% and is
 * worth 1,595h. A page sorted by percentage opens with the artefact and buries
 * the money. The percentage is still there, still flagged, still sortable by
 * clicking the header — it is just not what the page argues with.
 *
 * The > 15% flag arrives pre-computed as the view's `writeoff_flagged`, off
 * `v_metric_config.writeoff_alert_pct`. The page never recomputes it, so
 * retuning the threshold is one `CREATE OR REPLACE` and no frontend change.
 */
export function WriteoffLedger({ rows }: { rows: WriteoffProjectRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const withWriteoff = useMemo(
    () => rows.filter((r) => r.non_billable_hours > 0 || r.untagged_hours > 0),
    [rows],
  )
  const visible = showAll ? withWriteoff : withWriteoff.slice(0, LEDGER_TOP_N)

  return (
    <div className="space-y-2">
      <DataTable
        data={visible}
        columns={COLUMNS}
        emptyText="No project has written off an hour since the 2025 floor."
      />
      {withWriteoff.length > LEDGER_TOP_N ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {showAll ? `Show top ${LEDGER_TOP_N}` : `Show all ${withWriteoff.length} projects`}
        </button>
      ) : null}
    </div>
  )
}
