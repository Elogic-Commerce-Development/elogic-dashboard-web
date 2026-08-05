import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { SourceBadge } from '@/components/SourceBadge'
import { formatHours } from '@/lib/format'
import {
  bySize,
  bySource,
  byQuarter,
  histogram,
  formatPct,
  formatRatioX,
  segmentLabel,
  summarize,
  type CalibrationSummary,
} from '@/lib/estimation'
import type { CalibrationTask, ProjectCalibrationRow, ZeroTracked } from '@/lib/queries'
import { CalibrationTrendChart, RatioHistogram } from './CalibrationCharts'
import { Block, Chip, LoadFailure, Loading, Panel, StatTile } from './Section'

export type CalibrationData = {
  sample: CalibrationTask[]
  projects: ProjectCalibrationRow[]
  zeroTracked: ZeroTracked | null
}

/** Shared header for the three summary cuts, so they read as one instrument. */
function CutTable<T extends { key: string; summary: CalibrationSummary }>({
  rows,
  firstHeader,
  renderKey,
}: {
  rows: T[]
  firstHeader: string
  renderKey?: (row: T) => React.ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-1.5 font-medium">{firstHeader}</th>
            <th className="px-3 py-1.5 text-right font-medium">n</th>
            <th className="px-3 py-1.5 text-right font-medium">Median</th>
            <th className="px-3 py-1.5 text-right font-medium">Mean</th>
            <th className="px-3 py-1.5 text-right font-medium">In band</th>
            <th className="px-3 py-1.5 text-right font-medium">Exact</th>
            <th className="px-3 py-1.5 text-right font-medium">Blew 2×</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <tr key={r.key} className={r.summary.n === 0 ? 'text-neutral-400' : ''}>
              <td className="px-3 py-2 font-medium">{renderKey ? renderKey(r) : r.key}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.summary.n}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {formatRatioX(r.summary.median_ratio)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                {formatRatioX(r.summary.mean_ratio)}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-700">
                {formatPct(r.summary.in_band_pct)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                {formatPct(r.summary.exact_match_pct)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-red-600">
                {formatPct(r.summary.blew_2x_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PROJECT_COLUMNS: ColumnDef<ProjectCalibrationRow>[] = [
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
    accessorKey: 'n',
    header: 'n',
    cell: ({ getValue }) => <span className="tabular-nums">{Number(getValue())}</span>,
  },
  {
    accessorKey: 'median_ratio',
    header: 'Median ratio',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      const cls = v == null ? '' : v >= 2 ? 'text-red-600' : v >= 1.5 ? 'text-amber-600' : ''
      return <span className={`font-medium tabular-nums ${cls}`}>{formatRatioX(v)}</span>
    },
  },
  {
    accessorKey: 'in_band_pct',
    header: 'In band',
    cell: ({ getValue }) => (
      <span className="font-medium tabular-nums text-emerald-700">
        {formatPct(getValue() as number | null)}
      </span>
    ),
  },
  {
    accessorKey: 'exact_match_pct',
    header: 'Exact match',
    cell: ({ row }) => (
      <span className="tabular-nums text-neutral-600">
        {formatPct(row.original.exact_match_pct)}
        {row.original.exact_match_flagged ? (
          <span
            className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-800"
            title="Above the 40% trust flag — an exact-match rate this high usually means block allocation or fit-to-estimate logging, not accuracy"
          >
            flag
          </span>
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: 'zero_tracked_tasks',
    header: 'Est., never tracked',
    cell: ({ row }) => (
      <span className="tabular-nums text-neutral-600">
        {row.original.zero_tracked_tasks === 0
          ? '—'
          : `${row.original.zero_tracked_tasks} / ${formatHours(row.original.zero_tracked_estimate_hours)}`}
      </span>
    ),
  },
]

/**
 * §4.2's calibration block — second, on purpose.
 *
 * The sample is completed estimated tasks that were actually tracked
 * (`is_calibration_sample`); zero-tracked completions are reported beside it
 * rather than folded in, because a 0/8 ratio is missing data, not a 100%
 * underrun. Every cut below is a slice of the same array, so the histogram,
 * the trend, the size cut and the source benchmark cannot disagree.
 */
export function CalibrationBlock({
  data,
  loading,
  error,
}: {
  data: CalibrationData
  loading: boolean
  error?: string
}) {
  const overall = useMemo(() => summarize(data.sample), [data.sample])
  const bins = useMemo(() => histogram(data.sample), [data.sample])
  const quarters = useMemo(() => byQuarter(data.sample), [data.sample])
  const sizes = useMemo(() => bySize(data.sample), [data.sample])
  const sources = useMemo(() => bySource(data.sample), [data.sample])

  const firstQuarter = quarters[0]
  const lastQuarter = quarters[quarters.length - 1]

  return (
    <Block
      title="Calibration — were the prices right?"
      blurb="Completed tasks that carried an estimate and actually got time logged against them, ratio =
        actual ÷ estimate. Gross and unnetted: an underrun never cancels an overrun, because the two
        cost different people different things."
    >
      {loading ? (
        <Loading what="calibration" />
      ) : error ? (
        <LoadFailure what="Calibration" error={error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Median ratio"
              value={formatRatioX(overall.median_ratio)}
              emphasis
              caption={
                <>
                  vs a mean of{' '}
                  <span className="font-semibold text-neutral-700">{formatRatioX(overall.mean_ratio)}</span> —
                  the gap is the long right tail, not a typical task. n = {overall.n}
                </>
              }
            />
            <StatTile
              label="In band (0.8–1.2)"
              value={formatPct(overall.in_band_pct)}
              tone="emerald"
              caption={`Exact match ${formatPct(overall.exact_match_pct)} — shown beside it because an exact-match rate above 40% is a logging artefact, not accuracy`}
            />
            <StatTile
              label="Blew 2×"
              value={formatPct(overall.blew_2x_pct)}
              tone="red"
              caption={`${overall.blew_2x} tasks finished at more than twice their estimate · p90 ${formatRatioX(overall.p90_ratio)}`}
            />
            <StatTile
              label="Estimated, never tracked"
              value={data.zeroTracked == null ? '—' : String(data.zeroTracked.tasks)}
              caption={
                data.zeroTracked == null
                  ? 'not measured'
                  : `${formatHours(data.zeroTracked.estimate_hours)} of estimates completed with zero hours logged — excluded from the ratio above rather than counted as a 100% underrun`
              }
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="Ratio distribution"
              blurb="Where the completed work actually landed against its estimate."
              meta={`${overall.n} tasks`}
            >
              <RatioHistogram bins={bins} />
            </Panel>

            <Panel
              title="Calibration by quarter"
              blurb="By completion date — when the ratio settled, not when the task was opened."
              meta={
                firstQuarter && lastQuarter && firstQuarter !== lastQuarter
                  ? `${firstQuarter.quarter} → ${lastQuarter.quarter}`
                  : undefined
              }
            >
              <CalibrationTrendChart points={quarters} />
              {firstQuarter && lastQuarter && firstQuarter !== lastQuarter ? (
                <p className="border-t border-neutral-100 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
                  Blew 2× moved from{' '}
                  <span className="font-semibold text-neutral-700">
                    {formatPct(firstQuarter.blew_2x_pct)}
                  </span>{' '}
                  in {firstQuarter.quarter} (n = {firstQuarter.n}) to{' '}
                  <span className="font-semibold text-neutral-700">
                    {formatPct(lastQuarter.blew_2x_pct)}
                  </span>{' '}
                  in {lastQuarter.quarter} (n = {lastQuarter.n}). The most recent quarter is still
                  filling — tasks completed after it closes will not appear until they are.
                </p>
              ) : null}
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="By estimate size"
              blurb="Bucketed on the estimate, not the actual — the question is whether small estimates are systematically optimistic."
            >
              <CutTable rows={sizes.map((c) => ({ key: c.key, summary: c.summary }))} firstHeader="Estimate" />
            </Panel>

            <Panel
              title="ActiveCollab vs Jira"
              blurb="The same teams, two tools. Jira asks for an estimate as part of the workflow; this is the internal proof the process can work here."
            >
              <CutTable
                rows={sources.map((c) => ({ key: c.label, summary: c.summary }))}
                firstHeader="Source"
              />
              <p className="border-t border-neutral-100 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
                Read as a benchmark on estimation practice only. The two sources are not comparable
                on QA or billability — Jira carries no billable flag at all, and its QA coverage is
                twenty times ActiveCollab&rsquo;s.
              </p>
            </Panel>
          </div>

          <Panel
            title="Calibration by project"
            blurb="Exact-match % beside in-band % at every grain, per §5's trust flag."
            meta={`${data.projects.length} projects`}
          >
            <DataTable
              data={data.projects}
              columns={PROJECT_COLUMNS}
              emptyText="No project has a completed, tracked, estimated task."
            />
          </Panel>
        </>
      )}
    </Block>
  )
}
