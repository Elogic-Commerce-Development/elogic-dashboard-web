/**
 * The period model — one preset vocabulary for the whole app.
 *
 * This module replaces the three period systems the dashboard grew
 * independently (redesign plan §3 "Three period systems → one"):
 *
 *   1. `lib/period.ts` point-in-time presets  → person / project detail pages
 *   2. `lib/dashboardPeriod.ts` rolling presets → Dashboard home
 *   3. the FilterBar's raw From/To date inputs → Overview / Estimates / People / Projects
 *
 * All three now speak the `PeriodPreset` vocabulary below, are selected through
 * the single `<PeriodSwitcher>` component, and live in the URL as `?period=`.
 *
 * **Selection layer only.** This module resolves a preset to `{from,to}`; what
 * a page does with that is the page's business. F2 moved the grids onto the
 * canonical `v_metric_*` views, which answer at exactly two grains, so
 * `PeoplePage` / `ProjectsPage` branch on the preset itself (`all_time` vs one
 * calendar month) rather than on a date range. F4 removed the last consumer of
 * the old `periodFilterRange()` shim along with the Overview / Estimates pages
 * it fed.
 *
 * ISO weeks: Monday is the first day of the week. All date math is UTC to
 * avoid client-timezone drift on the day boundary.
 */

export type PeriodPreset =
  // point-in-time
  | 'current_week'
  | 'last_week'
  | 'current_month'
  | 'previous_month'
  | 'current_year'
  | 'previous_year'
  // rolling calendar-month windows (ex-`3m`/`6m`/`12m`)
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months'
  // open-ended
  | 'all_time'
  | 'custom'

export type PeriodRange = { from: string; to: string }

/**
 * Data floor — tasks are synced from this date on (AC_SYNC_FROM_DATE in the
 * backend).
 */
export const TRACKING_FLOOR = '2025-01-01'

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  current_week: 'Current week',
  last_week: 'Last week',
  current_month: 'Current month',
  previous_month: 'Previous month',
  last_3_months: 'Last 3 months',
  last_6_months: 'Last 6 months',
  last_12_months: 'Last 12 months',
  current_year: 'Year to date',
  previous_year: 'Previous year',
  all_time: 'All time',
  custom: 'Custom',
}

/**
 * Which presets each surface offers, and which of them render as pills rather
 * than sitting in the "More periods" dropdown.
 *
 * Each group reproduces exactly the option set that surface shipped before the
 * unification, so no page's default — and therefore no page's numbers — moves:
 * Dashboard kept its five rolling windows, the person page still has no
 * "All time", the project page still does. `list` is the new one: its default
 * is `all_time`, which resolves to *no* date filter, i.e. what those pages
 * queried when the FilterBar's From/To were left empty.
 */
export type PeriodGroup = {
  readonly primary: readonly PeriodPreset[]
  readonly secondary: readonly PeriodPreset[]
  readonly default: PeriodPreset
}

export const PERIOD_GROUPS = {
  /** Dashboard home — rolling windows only, no custom range (see F2). */
  dashboard: {
    primary: ['last_3_months', 'last_6_months', 'last_12_months', 'current_year', 'all_time'],
    secondary: [],
    default: 'last_6_months',
  },
  /** Person detail — deliberately excludes `all_time`. */
  person: {
    primary: ['current_week', 'last_week', 'current_month'],
    secondary: ['previous_month', 'current_year', 'previous_year', 'custom'],
    default: 'current_month',
  },
  /**
   * Project detail — month-aligned presets only (F6).
   *
   * The page's period mode reads S7's `v_metric_task_contributor_month`, whose
   * grain is (task, person, calendar month): hours sum exactly over any month
   * range and task counts stay exact via client-side DISTINCT, but a week or an
   * arbitrary custom range would need day-grain data no canonical view carries.
   * Same trade F2 made for the grids — a preset the data cannot answer exactly
   * is not offered. Weeks/custom can return with a task × day view.
   */
  project: {
    primary: ['current_month', 'previous_month', 'all_time'],
    secondary: ['current_year', 'previous_year'],
    default: 'current_month',
  },
  /**
   * People / Projects — the canonical grids (F2).
   *
   * Deliberately narrower than `list`. These two grids read the §5 metric
   * views, which exist at exactly two grains: all-time, and one calendar
   * month. Any other range would have to sum month rows, and the month views'
   * task counters are distinct *per month* — summing them double-counts every
   * task worked across a boundary (+30% person / +56% project over the full
   * range). Offering a preset the data cannot answer exactly is how a live
   * management dashboard grows a wrong number, so it is not offered.
   * F5/F6 widen this again on top of a period-grain view (see the progress
   * log's F2 open question).
   */
  grid: {
    primary: ['all_time', 'current_month', 'previous_month'],
    secondary: [],
    default: 'all_time',
  },
  /**
   * The permissive group the `/people` and `/projects` **routes** validate
   * their URL against. It outlives the Overview / Estimates pages it was built
   * for (deleted in F4) because those two routes deliberately accept a wider
   * set than their pages offer and re-validate against `grid` in the component
   * — so a pre-F2 bookmark reaches the page and falls back to its default
   * instead of being rejected at the router.
   */
  list: {
    primary: ['all_time', 'current_month', 'previous_month'],
    secondary: [
      'current_week',
      'last_week',
      'last_3_months',
      'last_6_months',
      'last_12_months',
      'current_year',
      'previous_year',
      'custom',
    ],
    default: 'all_time',
  },
} as const satisfies Record<string, PeriodGroup>

/** Every preset a group accepts, in display order. */
export function groupPresets(group: PeriodGroup): PeriodPreset[] {
  return [...group.primary, ...group.secondary]
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
    // Rolling windows snap to the first of the month N-1 months back, so a
    // "last 6 months" window is six whole calendar months including this one.
    case 'last_3_months':
      return { from: toIso(startOfMonth(addMonths(today, -2))), to: toIso(today) }
    case 'last_6_months':
      return { from: toIso(startOfMonth(addMonths(today, -5))), to: toIso(today) }
    case 'last_12_months':
      return { from: toIso(startOfMonth(addMonths(today, -11))), to: toIso(today) }
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
      // Informational range (the switcher caption, and the Dashboard's month
      // enumeration). A page that queries per period must branch on the preset
      // itself — `all_time` means "no date filter", not "since the floor", and
      // resolving it to TRACKING_FLOOR in a query would move numbers.
      return { from: TRACKING_FLOOR, to: toIso(today) }
    case 'custom':
      return {
        from: customFrom ?? toIso(startOfMonth(today)),
        to: customTo ?? toIso(today),
      }
  }
}

/**
 * URL search → preset, accepting only what this surface offers.
 *
 * Returns `undefined` for anything the group doesn't offer — the page then
 * falls back to the group default, which is why every search field stays
 * optional and existing `<Link>` call sites without search params still
 * type-check.
 *
 * Back-compat, so no pre-unification bookmark changes meaning:
 *   - `period` is the canonical key. It was also the Dashboard's key, so a
 *     value read from it may still be one of the old rolling ids
 *     (`3m`/`6m`/`12m`/`ytd`/`all`) and is mapped through the alias table.
 *   - `preset` was the detail pages' key and only ever carried canonical
 *     names, so it is read **without** the aliases. That matters: `?preset=ytd`
 *     was meaningless on the person page before (it fell back to the default),
 *     and aliasing it here would newly resolve it to "Year to date" — a URL
 *     quietly changing meaning is exactly what this shim exists to prevent.
 */
export function parsePeriodSearch(
  search: Record<string, unknown>,
  group: PeriodGroup,
): PeriodPreset | undefined {
  const offered = groupPresets(group)

  if (typeof search.period === 'string') {
    const canonical = LEGACY_PRESET_ALIASES[search.period] ?? search.period
    return offered.includes(canonical as PeriodPreset) ? (canonical as PeriodPreset) : undefined
  }
  if (typeof search.preset === 'string') {
    return offered.includes(search.preset as PeriodPreset) ? (search.preset as PeriodPreset) : undefined
  }
  return undefined
}

/** The Dashboard's pre-unification preset ids. */
const LEGACY_PRESET_ALIASES: Record<string, PeriodPreset> = {
  '3m': 'last_3_months',
  '6m': 'last_6_months',
  '12m': 'last_12_months',
  ytd: 'current_year',
  all: 'all_time',
}

/**
 * The `?period=…&from=…&to=…` triplet for a navigation. The preset is omitted
 * when it equals the surface's default, so the canonical URL of a page at its
 * default period carries no search params at all (as `/` and `/people/$id`
 * always have).
 */
export function periodSearchParams(
  preset: PeriodPreset,
  group: PeriodGroup,
  customFrom?: string,
  customTo?: string,
): { period?: PeriodPreset; from?: string; to?: string } {
  return {
    period: preset === group.default ? undefined : preset,
    from: preset === 'custom' ? customFrom : undefined,
    to: preset === 'custom' ? customTo : undefined,
  }
}

/**
 * Emit a list of first-of-month ISO strings covering every month in the
 * range, inclusive. Used by the Dashboard charts to render empty buckets for
 * months with no qualifying tasks. Always at least one entry.
 */
export function enumerateMonths(range: PeriodRange): string[] {
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
