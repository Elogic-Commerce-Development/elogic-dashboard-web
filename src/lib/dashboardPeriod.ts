/**
 * Rolling-window period presets for the Dashboard home page. Each preset
 * resolves to an ISO `from`/`to` date range relative to today.
 *
 * Distinct from `period.ts` (which has point-in-time presets like
 * "current week" / "previous month") so the two semantic models don't
 * collide. All date math is UTC to avoid client-timezone drift.
 */

export type DashboardPeriodPreset = '3m' | '6m' | '12m' | 'ytd' | 'all'

export type DashboardPeriodRange = { from: string; to: string }

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriodPreset = '6m'

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriodPreset, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  ytd: 'Year to date',
  all: 'All time',
}

export const DASHBOARD_PERIOD_ORDER: DashboardPeriodPreset[] = ['3m', '6m', '12m', 'ytd', 'all']

/** Tracking cutoff — matches CLAUDE.md / scope decision; see [project-scope-decision] memory. */
const TRACKING_FLOOR = '2025-01-01'

export function isValidDashboardPeriodPreset(value: string | undefined): value is DashboardPeriodPreset {
  if (value === undefined) return false
  return DASHBOARD_PERIOD_ORDER.includes(value as DashboardPeriodPreset)
}

export function dashboardPeriodRange(
  preset: DashboardPeriodPreset,
  reference: Date = new Date(),
): DashboardPeriodRange {
  const today = startOfDay(reference)
  const to = toIso(today)

  switch (preset) {
    case '3m':
      return { from: toIso(startOfMonth(addMonths(today, -2))), to }
    case '6m':
      return { from: toIso(startOfMonth(addMonths(today, -5))), to }
    case '12m':
      return { from: toIso(startOfMonth(addMonths(today, -11))), to }
    case 'ytd':
      return { from: toIso(startOfYear(today)), to }
    case 'all':
      return { from: TRACKING_FLOOR, to }
  }
}

/**
 * Emit a list of first-of-month ISO strings covering every month in the
 * range, inclusive. Used by charts to render empty buckets for months
 * with no qualifying tasks. Always at least one entry.
 */
export function enumerateMonths(range: DashboardPeriodRange): string[] {
  const fromDate = new Date(range.from + 'T00:00:00Z')
  const toDate = new Date(range.to + 'T00:00:00Z')
  const cursor = startOfMonth(fromDate)
  const end = startOfMonth(toDate)
  const months: string[] = []
  while (cursor <= end) {
    months.push(toIso(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()))
}

function toIso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
