import { useEffect, useState } from 'react'
import { useFilters } from '@/lib/FilterContext'
import { Accordion } from '@/components/Accordion'
import { TasksWithoutEstimatesTable } from '@/components/metrics/TasksWithoutEstimatesTable'
import { OverrunTable } from '@/components/metrics/OverrunTable'
import { fetchOverviewCounts } from '@/lib/queries'

export function OverviewPage() {
  const { filters } = useFilters()
  // Both sections start collapsed so it's clear there's more than one.
  const [openWithout, setOpenWithout] = useState(false)
  const [openOverrun, setOpenOverrun] = useState(false)
  const [counts, setCounts] = useState<{ withoutEstimates: number; overrun: number } | null>(null)

  // Counts are fetched at the page level (not from the tables) so the header
  // total shows even while the section is collapsed and its table unmounted.
  // setState only in the async callbacks (not synchronously in the body), so a
  // filter change keeps the prior count visible until the new one resolves.
  useEffect(() => {
    let cancelled = false
    fetchOverviewCounts(filters)
      .then((c) => {
        if (!cancelled) setCounts(c)
      })
      .catch(() => {
        if (!cancelled) setCounts(null)
      })
    return () => {
      cancelled = true
    }
  }, [filters])

  const meta = (n: number | undefined) => (n === undefined ? '…' : `${n} task${n === 1 ? '' : 's'}`)

  return (
    <div className="space-y-4">
      <Accordion
        title="Tasks without estimates"
        meta={meta(counts?.withoutEstimates)}
        open={openWithout}
        onToggle={() => setOpenWithout((v) => !v)}
      >
        <p className="mb-2 text-xs text-neutral-500">Open, in-progress tasks that need sizing.</p>
        <TasksWithoutEstimatesTable filters={filters} />
      </Accordion>

      <Accordion
        title="Tasks overrun"
        meta={meta(counts?.overrun)}
        open={openOverrun}
        onToggle={() => setOpenOverrun((v) => !v)}
      >
        <p className="mb-2 text-xs text-neutral-500">Tasks where actual hours exceeded the estimate.</p>
        <OverrunTable filters={filters} />
      </Accordion>
    </div>
  )
}
