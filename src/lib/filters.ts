import { z } from 'zod'

export const FiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  projectIds: z.array(z.number()).default([]),
  userIds: z.array(z.number()).default([]),
})

export type Filters = z.infer<typeof FiltersSchema>

export const defaultFilters: Filters = {
  from: undefined,
  to: undefined,
  projectIds: [],
  userIds: [],
}
