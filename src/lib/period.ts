/**
 * Period presets for the employee utilization page. Each preset resolves to
 * an ISO `from`/`to` date range. "Current week" and "Current month" end at
 * today (running totals); the other historical presets cover the full span.
 *
 * ISO weeks: Monday is the first day of the week.
 */

export type PeriodPreset =
  | 'current_week'
  | 'last_week'
  | 'current_month'
  | 'previous_month'
  | 'current_year'
  | 'previous_year'
  | 'all_time'
  | 'custom'

export type PeriodRange = { from: string; to: string }

/**
 * Data floor — tasks are synced from this date on (AC_SYNC_FROM_DATE in the
 * backend). Duplicated as a private const in dashboardPeriod.ts; the two
 * period modules are deliberately independent.
 */
export const TRACKING_FLOOR = '2025-01-01'

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  current_week: 'Current week',
  last_week: 'Last week',
  current_month: 'Current month',
  previous_month: 'Previous month',
  current_year: 'Current year',
  previous_year: 'Previous year',
  all_time: 'All time',
  custom: 'Custom',
}

export function periodRange(
  preset: PeriodPreset,
  customFrom?: string,
  customTo?: string,
  reference: Date = new Date(),
): PeriodRange {
  const today = startOfDay(reference)

  switch (preset) {
    case 'current_week':
      return { from: toIso(startOfIsoWeek(today)), to: toIso(today) }
    case 'last_week': {
      const startThisWeek = startOfIsoWeek(today)
      const endLastWeek = addDays(startThisWeek, -1)        // Sunday
      const startLastWeek = addDays(startThisWeek, -7)      // Monday
      return { from: toIso(startLastWeek), to: toIso(endLastWeek) }
    }
    case 'current_month':
      return { from: toIso(startOfMonth(today)), to: toIso(today) }
    case 'previous_month': {
      const start = startOfMonth(addMonths(today, -1))
      const end = endOfMonth(start)
      return { from: toIso(start), to: toIso(end) }
    }
    case 'current_year':
      return { from: toIso(startOfYear(today)), to: toIso(today) }
    case 'previous_year': {
      const lastYear = today.getUTCFullYear() - 1
      return {
        from: `${lastYear}-01-01`,
        to: `${lastYear}-12-31`,
      }
    }
    case 'all_time':
      // Range is informational (PeriodSwitcher label); pages treat the
      // preset itself as "no period filter" rather than querying this span.
      return { from: TRACKING_FLOOR, to: toIso(today) }
    case 'custom':
      return {
        from: customFrom ?? toIso(startOfMonth(today)),
        to: customTo ?? toIso(today),
      }
  }
}

export function isValidPreset(value: string | undefined): value is PeriodPreset {
  if (value === undefined) return false
  // Deliberately excludes 'all_time' — the person page keeps its original
  // preset set; only the project page opts in via isValidProjectPreset.
  return ['current_week', 'last_week', 'current_month', 'previous_month', 'current_year', 'previous_year', 'custom'].includes(value)
}

export function isValidProjectPreset(value: string | undefined): value is PeriodPreset {
  return isValidPreset(value) || value === 'all_time'
}

// All date math is in UTC to avoid client-timezone drift on the date boundary.

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

function startOfIsoWeek(d: Date): Date {
  // ISO week starts Monday. getUTCDay returns 0=Sun..6=Sat.
  const dow = d.getUTCDay()
  const offset = dow === 0 ? -6 : 1 - dow
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset))
}

function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()))
}

function addDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
}

function toIso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
