import { useNavigate, useSearch } from '@tanstack/react-router'
import { EstimateVsActualTable } from '@/components/metrics/EstimateVsActualTable'
import { AccuracyByProjectTable } from '@/components/metrics/AccuracyByProjectTable'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { PERIOD_GROUPS, periodSearchParams, type PeriodPreset } from '@/lib/period'
import { useListFilters } from '@/lib/useListFilters'

export function EstimatesPage() {
  const search = useSearch({ from: '/estimates' })
  const navigate = useNavigate()
  const { preset, filters } = useListFilters(search)

  function setPeriod(next: PeriodPreset, customFrom?: string, customTo?: string) {
    navigate({
      to: '/estimates',
      search: () => periodSearchParams(next, PERIOD_GROUPS.list, customFrom, customTo),
    })
  }

  return (
    <div className="space-y-6">
      <PeriodSwitcher
        preset={preset}
        group={PERIOD_GROUPS.list}
        customFrom={search.from}
        customTo={search.to}
        onChange={setPeriod}
      />
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
