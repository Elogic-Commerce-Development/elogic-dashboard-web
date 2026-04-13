import { useFilters } from '@/lib/FilterContext'
import { EstimateVsActualTable } from '@/components/metrics/EstimateVsActualTable'
import { AccuracyByProjectTable } from '@/components/metrics/AccuracyByProjectTable'

export function EstimatesPage() {
  const { filters } = useFilters()

  return (
    <div className="space-y-6">
      <Section title="Estimate vs actual" description="Every task with an estimate, sorted by creation date.">
        <EstimateVsActualTable filters={filters} />
      </Section>
      <Section title="Accuracy by project" description="Completed tasks only. Based on task assignee.">
        <AccuracyByProjectTable filters={filters} />
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
