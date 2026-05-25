import {
  DASHBOARD_PERIOD_LABELS,
  DASHBOARD_PERIOD_ORDER,
  type DashboardPeriodPreset,
} from '@/lib/dashboardPeriod'

type Props = {
  preset: DashboardPeriodPreset
  onChange: (preset: DashboardPeriodPreset) => void
}

export function DashboardPeriodSwitcher({ preset, onChange }: Props) {
  return (
    <div role="group" aria-label="Period" className="flex flex-wrap items-center gap-1.5">
      {DASHBOARD_PERIOD_ORDER.map((p) => {
        const active = preset === p
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={active}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {DASHBOARD_PERIOD_LABELS[p]}
          </button>
        )
      })}
    </div>
  )
}
