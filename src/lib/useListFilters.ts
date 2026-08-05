import { useMemo } from 'react'
import { useFilters } from './FilterContext'
import { PERIOD_GROUPS, periodFilterRange, type PeriodPreset } from './period'
import type { Filters } from './filters'

/**
 * The list grids' effective filters: the FilterBar's entity selections
 * (projects / users, still React state on AppLayout) merged with the period
 * from the URL.
 *
 * The merge is what replaced the FilterBar's raw From/To inputs — the period
 * moved to the URL and the unified switcher, but it still arrives at the
 * fetchers as the same `Filters.from` / `Filters.to` ISO strings, so no data
 * path changed. At the `all_time` default `periodFilterRange` yields no
 * bounds, which is exactly the query these pages ran with the date inputs
 * left empty.
 *
 * Memoized deliberately: every metric table keys its fetch effect on the
 * `filters` **object identity**, so returning a fresh object each render would
 * re-fetch on every render.
 */
export function useListFilters(search: {
  period?: PeriodPreset
  from?: string
  to?: string
}): { preset: PeriodPreset; filters: Filters } {
  const { filters } = useFilters()
  const preset = search.period ?? PERIOD_GROUPS.list.default
  const { from, to } = search

  const scoped = useMemo(
    () => ({ ...filters, ...periodFilterRange(preset, from, to) }),
    [filters, preset, from, to],
  )

  return { preset, filters: scoped }
}
