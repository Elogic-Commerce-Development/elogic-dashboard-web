/**
 * Period presets for the employee utilization page. Each preset resolves to
 * an ISO `from`/`to` date range. "Current week" and "Current month" end at
 * today (running totals); the other historical presets cover the full span.
 *
 * ISO weeks: Monday is the first day of the week.
 */

export type PeriodPreset =
  | 'current_week'
  | 'current_month'
  | 'previous_month'
  | 'current_year'
  | 'previous_year'
  | 'custom'

export type PeriodRange = { from: string; to: string }

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  current_week: 'Current week',
  current_month: 'Current month',
  previous_month: 'Previous month',
  current_year: 'Current year',
  previous_year: 'Previous year',
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
    case 'custom':
      return {
        from: customFrom ?? toIso(startOfMonth(today)),
        to: customTo ?? toIso(today),
      }
  }
}

export function isValidPreset(value: string | undefined): value is PeriodPreset {
  if (value === undefined) return false
  return ['current_week', 'current_month', 'previous_month', 'current_year', 'previous_year', 'custom'].includes(value)
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

function toIso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
