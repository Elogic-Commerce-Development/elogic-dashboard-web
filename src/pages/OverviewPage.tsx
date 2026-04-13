import { useFilters } from '@/lib/FilterContext'
import { TasksWithoutEstimatesTable } from '@/components/metrics/TasksWithoutEstimatesTable'
import { OverrunTable } from '@/components/metrics/OverrunTable'

export function OverviewPage() {
  const { filters } = useFilters()

  return (
    <div className="space-y-6">
      <Section title="Tasks without estimates" description="Open, in-progress tasks that need sizing.">
        <TasksWithoutEstimatesTable filters={filters} />
      </Section>
      <Section title="Tasks overrun" description="Tasks where actual hours exceeded the estimate.">
        <OverrunTable filters={filters} />
      </Section>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {description && <p className="text-xs text-neutral-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}
