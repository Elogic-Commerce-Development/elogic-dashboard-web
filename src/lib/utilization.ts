import type { EmployeeDay } from './queries'

/**
 * Visualization baseline used for weekend slices in the chart so they show
 * non-zero area. Matches the typical Mon–Fri 8h pattern; if a part-time
 * employee is being viewed, this is still 8h for visual consistency.
 *
 * The plan §7.3 notes this as the explicit "weekends use 8h baseline" rule.
 */
const WEEKEND_VIS_HOURS = 8

export type UtilizationBucket =
  | 'tracked'
  | 'over_tracked'
  | 'untracked_working'
  | 'vacation'
  | 'sick'
  | 'other_paid'
  | 'other_unpaid'
  | 'bench'
  | 'holiday'
  | 'weekend'

export const BUCKET_LABELS: Record<UtilizationBucket, string> = {
  tracked: 'Tracked',
  over_tracked: 'Over-tracked',
  untracked_working: 'Untracked working',
  vacation: 'Vacation',
  sick: 'Sick leave',
  other_paid: 'Other paid leave',
  other_unpaid: 'Other unpaid leave',
  bench: 'Bench',
  holiday: 'Public holiday',
  weekend: 'Weekend',
}

/** Tailwind color hex values used by Recharts (cannot use Tailwind class names). */
export const BUCKET_COLORS: Record<UtilizationBucket, string> = {
  tracked: '#059669',          // emerald-600
  over_tracked: '#db2777',     // pink-600
  untracked_working: '#dc2626', // red-600
  vacation: '#2563eb',         // blue-600
  sick: '#d97706',             // amber-600
  other_paid: '#0891b2',       // cyan-600
  other_unpaid: '#525252',     // neutral-600
  bench: '#7c3aed',            // violet-600
  holiday: '#a855f7',          // purple-500
  weekend: '#a3a3a3',          // neutral-400
}

export type UtilizationSummary = {
  // Period bounds (echoed from input)
  from: string
  to: string
  totalDays: number

  // Bucket totals in hours, ready for the donut chart.
  buckets: Record<UtilizationBucket, number>

  // Day counts surfaced in summary cards.
  workingDayCount: number
  weekendDayCount: number
  holidayDayCount: number     // non-working holidays only
  vacationDayCount: number
  sickDayCount: number
  benchDayCount: number
  wfhDayCount: number         // informational — never a chart slice
  unmappedLeaveDayCount: number

  // Header/KPIs.
  expectedHours: number
  trackedHours: number
  overTrackedHours: number
  untrackedWorkingHours: number
  unmappedLeaveHours: number

  // Total of all chart segments — equals working_hours_baseline + weekend_baseline.
  chartTotal: number
}

const ZERO_BUCKETS: Record<UtilizationBucket, number> = {
  tracked: 0,
  over_tracked: 0,
  untracked_working: 0,
  vacation: 0,
  sick: 0,
  other_paid: 0,
  other_unpaid: 0,
  bench: 0,
  holiday: 0,
  weekend: 0,
}

/**
 * Roll a list of per-day rows into bucket totals + counts. Implements §7
 * of the plan exactly — see comments below for each branch.
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
  let benchDayCount = 0
  let wfhDayCount = 0
  let unmappedLeaveDayCount = 0
  let expectedHours = 0
  let trackedHours = 0
  let overTrackedHours = 0
  let untrackedWorkingHours = 0
  let unmappedLeaveHours = 0

  for (const d of days) {
    const expected = Number(d.expected_hours)
    const tracked = Number(d.tracked_hours)
    const base = Number(d.expected_hours_base)

    expectedHours += expected
    trackedHours += tracked

    // Tracked is clamped to expected for chart display so the donut sums to a
    // meaningful 100%; surplus appears as the over_tracked slice instead.
    const trackedInChart = Math.min(tracked, expected)
    const overTracked = Math.max(tracked - expected, 0)
    buckets.tracked += trackedInChart
    buckets.over_tracked += overTracked
    overTrackedHours += overTracked

    // Day-type accounting. Priority mirrors v_employee_day's CASE: weekend >
    // non-working holiday > bench > leave reduction > regular working day.
    if (d.is_weekend) {
      weekendDayCount += 1
      buckets.weekend += WEEKEND_VIS_HOURS
      continue  // weekend days don't contribute to working-hour buckets
    }

    if (d.is_non_working_holiday) {
      holidayDayCount += 1
      buckets.holiday += base
      continue
    }

    if (d.leave_bucket === 'bench') {
      benchDayCount += 1
      // Bench reduces expected to 0; chart segment uses the pattern baseline
      // so it's visible. Tracked hours still appear via tracked/over_tracked.
      buckets.bench += base
      continue
    }

    // Regular working day (possibly with vacation/sick/other_paid/other_unpaid/wfh).
    workingDayCount += 1

    // Reduction from leave (zero if no leave or wfh/unmapped).
    const leaveReduction = Math.max(0, base - expected)

    if (d.leave_bucket === 'vacation') {
      buckets.vacation += leaveReduction
      vacationDayCount += 1
    } else if (d.leave_bucket === 'sick') {
      buckets.sick += leaveReduction
      sickDayCount += 1
    } else if (d.leave_bucket === 'other_paid') {
      buckets.other_paid += leaveReduction
    } else if (d.leave_bucket === 'other_unpaid') {
      buckets.other_unpaid += leaveReduction
    } else if (d.leave_bucket === 'wfh') {
      // WFH does not reduce expected and is not a chart slice; just count days.
      wfhDayCount += 1
    } else if (d.leave_bucket === 'unmapped') {
      unmappedLeaveDayCount += 1
      unmappedLeaveHours += leaveReduction
      // Surfaced separately as a warning card; not summed into chart.
    }

    // The remaining "untracked working" portion of the day, only counted for
    // the part of the day that was actually expected to be worked.
    const untracked = Math.max(expected - tracked, 0)
    buckets.untracked_working += untracked
    untrackedWorkingHours += untracked
  }

  const chartTotal =
    buckets.tracked +
    buckets.over_tracked +
    buckets.untracked_working +
    buckets.vacation +
    buckets.sick +
    buckets.other_paid +
    buckets.other_unpaid +
    buckets.bench +
    buckets.holiday +
    buckets.weekend

  return {
    from,
    to,
    totalDays: days.length,
    buckets,
    workingDayCount,
    weekendDayCount,
    holidayDayCount,
    vacationDayCount,
    sickDayCount,
    benchDayCount,
    wfhDayCount,
    unmappedLeaveDayCount,
    expectedHours,
    trackedHours,
    overTrackedHours,
    untrackedWorkingHours,
    unmappedLeaveHours,
    chartTotal,
  }
}
