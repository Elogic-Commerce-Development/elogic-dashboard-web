import { createContext, useContext } from 'react'
import { defaultFilters, type Filters } from './filters'

export const FilterContext = createContext<{
  filters: Filters
  setFilters: (next: Filters) => void
}>({
  filters: defaultFilters,
  setFilters: () => {},
})

export const useFilters = () => useContext(FilterContext)
