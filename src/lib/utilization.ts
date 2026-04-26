import type { EmployeeDay } from './queries'

/**
 * The chart denominator is "working hours in the period" — the number of
 * hours the employee was scheduled to work, excluding weekends and excluding
 * non-working public holidays. A typical week is 40h; a week with one
 * non-working holiday is 32h.
 *
 * Slices of that denominator (mutually exclusive):
 *   tracked         — hours the employee logged (capped at working_hours - absences)
 *   missing         — expected-and-not-logged: working_hours - absences - tracked (>=0)
 *   vacation        — paid vacation (dashboard_bucket = 'vacation')
 *   sick            — sick leave (dashboard_bucket = 'sick')
 *   unpaid_leave    — unpaid time off (dashboard_bucket = 'other_unpaid')
 *   other_absence   — bench, generic other_paid leaves, unmapped → all collapsed
 *
 * NOT in the chart (but surfaced separately):
 *   weekend_hours, holiday_hours — pure calendar info, excluded from denominator
 *   wfh_day_count                — informational only (WFH is a normal working day)
 *   over_tracked_hours           — hours beyond working_hours_after_absences
 *   unmapped_leave_hours         — surfaced as a warning if > 0
 */

export type UtilizationBucket =
  | 'tracked'
  | 'missing'
  | 'vacation'
  | 'sick'
  | 'unpaid_leave'
  | 'other_absence'

export const BUCKET_LABELS: Record<UtilizationBucket, string> = {
  tracked: 'Tracked',
  missing: 'Missing',
  vacation: 'Vacation',
  sick: 'Sick leave',
  unpaid_leave: 'Unpaid leave',
  other_absence: 'Other absence',
}

/** Tailwind hex values used by Recharts (cannot use Tailwind class names). */
export const BUCKET_COLORS: Record<UtilizationBucket, string> = {
  tracked: '#059669',        // emerald-600
  missing: '#dc2626',        // red-600
  vacation: '#2563eb',       // blue-600
  sick: '#d97706',           // amber-600
  unpaid_leave: '#525252',   // neutral-600
  other_absence: '#7c3aed',  // violet-600
}

export type UtilizationSummary = {
  // Period bounds (echoed from input)
  from: string
  to: string
  totalDays: number

  // Day counts.
  workingDayCount: number     // weekdays minus non-working holidays
  weekendDayCount: number
  holidayDayCount: number     // non-working holidays only
  vacationDayCount: number
  sickDayCount: number
  unpaidLeaveDayCount: number
  otherAbsenceDayCount: number
  wfhDayCount: number         // informational — never a chart slice

  // Bucket totals in hours, ready for the donut chart. Sum equals workingHours.
  buckets: Record<UtilizationBucket, number>

  // Top-line numbers.
  workingHours: number          // chart denominator: weekdays - holidays, all in hours
  trackedHours: number          // total logged in period (any day)
  missingHours: number          // working_hours - absences - tracked (clamped >= 0)
  overTrackedHours: number      // tracked beyond working_hours after absences
  unmappedLeaveHours: number    // policies with dashboard_bucket = 'unmapped'
  weekendHours: number          // informational only
  holidayHours: number          // informational only
}

const ZERO_BUCKETS: Record<UtilizationBucket, number> = {
  tracked: 0,
  missing: 0,
  vacation: 0,
  sick: 0,
  unpaid_leave: 0,
  other_absence: 0,
}

/**
 * Roll a list of per-day rows into the working-hours-only chart model.
 */
export function summarizeUtilization(
  days: EmployeeDay[],
  from: string,
  to: string,
): UtilizationSummary {
  const buckets: Record<UtilizationBucket, number> = { ...ZERO_BUCKETS }

  let workingDayCount = 0
  let weekendDayCount = 0
  let holidayDayCount = 0
  let vacationDayCount = 0
  let sickDayCount = 0
  let unpaidLeaveDayCount = 0
  let otherAbsenceDayCount = 0
  let wfhDayCount = 0

  let workingHours = 0          // sum of pattern hours over (weekday - holiday) days
  let trackedHours = 0          // sum across ALL days (including weekend/holiday "over-tracked")
  let unmappedLeaveHours = 0
  let weekendHours = 0
  let holidayHours = 0

  for (const d of days) {
    const base = Number(d.expected_hours_base)
    const expected = Number(d.expected_hours)
    const tracked = Number(d.tracked_hours)

    trackedHours += tracked

    // ── Day type accounting (priority: weekend → holiday → leave/working) ──

    if (d.is_weekend) {
      weekendDayCount += 1
      weekendHours += tracked  // tracked time on weekends — informational
      continue
    }

    if (d.is_non_working_holiday) {
      holidayDayCount += 1
      holidayHours += tracked
      continue
    }

    // From here: working day. Contributes to the chart denominator.
    workingDayCount += 1
    workingHours += base

    // Leave on a working day reduces expected_hours below base. The reduction
    // is what we book into the absence buckets.
    const leaveReduction = Math.max(0, base - expected)

    switch (d.leave_bucket) {
      case 'vacation':
        buckets.vacation += leaveReduction
        vacationDayCount += 1
        break
      case 'sick':
        buckets.sick += leaveReduction
        sickDayCount += 1
        break
      case 'other_unpaid':
        buckets.unpaid_leave += leaveReduction
        unpaidLeaveDayCount += 1
        break
      case 'bench':
        // Bench reduces expected to 0 for the day; the whole day is "other absence".
        buckets.other_absence += base
        otherAbsenceDayCount += 1
        break
      case 'other_paid':
        buckets.other_absence += leaveReduction
        otherAbsenceDayCount += 1
        break
      case 'unmapped':
        unmappedLeaveHours += leaveReduction
        // Surfaced separately; not summed into chart slices.
        break
      case 'wfh':
        wfhDayCount += 1
        // Doesn't reduce expected; not a chart slice.
        break
      case null:
      default:
        // Plain working day with no leave overlay.
        break
    }
  }

  // After all working days are processed, allocate the remaining
  // (working_hours - absences) between Tracked and Missing.
  const totalAbsences =
    buckets.vacation + buckets.sick + buckets.unpaid_leave + buckets.other_absence
  const availableForWork = Math.max(0, workingHours - totalAbsences)
  const trackedInChart = Math.min(trackedHours, availableForWork)
  const overTrackedHours = Math.max(0, trackedHours - availableForWork)
  const missingHours = Math.max(0, availableForWork - trackedInChart)

  buckets.tracked = trackedInChart
  buckets.missing = missingHours

  return {
    from,
    to,
    totalDays: days.length,
    workingDayCount,
    weekendDayCount,
    holidayDayCount,
    vacationDayCount,
    sickDayCount,
    unpaidLeaveDayCount,
    otherAbsenceDayCount,
    wfhDayCount,
    buckets,
    workingHours,
    trackedHours,
    missingHours,
    overTrackedHours,
    unmappedLeaveHours,
    weekendHours,
    holidayHours,
  }
}
