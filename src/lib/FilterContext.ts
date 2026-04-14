import { createContext, useContext } from 'react'
import { defaultFilters, type Filters } from './filters'

export const FilterContext = createContext<{
  filters: Filters
  setFilters: (next: Filters) => void
  /** Project IDs with the "OUTSOURCING PROJECT" label — dashboard scope */
  outsourcingProjectIds: number[]
}>({
  filters: defaultFilters,
  setFilters: () => {},
  outsourcingProjectIds: [],
})

export const useFilters = () => useContext(FilterContext)
