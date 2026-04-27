import { useState } from 'react'
import { PERIOD_LABELS, periodRange, type PeriodPreset } from '@/lib/period'

type Props = {
  preset: PeriodPreset
  customFrom?: string
  customTo?: string
  onChange: (preset: PeriodPreset, customFrom?: string, customTo?: string) => void
}

const SECONDARY_PRESETS: PeriodPreset[] = ['previous_month', 'current_year', 'previous_year', 'custom']

export function PeriodSwitcher({ preset, customFrom, customTo, onChange }: Props) {
  const [showMore, setShowMore] = useState(false)
  const [editingFrom, setEditingFrom] = useState(customFrom ?? '')
  const [editingTo, setEditingTo] = useState(customTo ?? '')

  const range = periodRange(preset, customFrom, customTo)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryPill
          active={preset === 'current_week'}
          onClick={() => onChange('current_week')}
          label="Current week"
        />
        <PrimaryPill
          active={preset === 'last_week'}
          onClick={() => onChange('last_week')}
          label="Last week"
        />
        <PrimaryPill
          active={preset === 'current_month'}
          onClick={() => onChange('current_month')}
          label="Current month"
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              SECONDARY_PRESETS.includes(preset)
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {SECONDARY_PRESETS.includes(preset) ? PERIOD_LABELS[preset] : 'More periods'} ▾
          </button>
          {showMore && (
            <div
              className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
              onMouseLeave={() => setShowMore(false)}
            >
              {SECONDARY_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setShowMore(false)
                    if (p === 'custom') {
                      // Default custom range to current_month so the date inputs show something.
                      const r = periodRange('current_month')
                      setEditingFrom(customFrom ?? r.from)
                      setEditingTo(customTo ?? r.to)
                      onChange('custom', customFrom ?? r.from, customTo ?? r.to)
                    } else {
                      onChange(p)
                    }
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50 ${
                    preset === p ? 'font-medium text-blue-700' : 'text-neutral-700'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="ml-auto text-xs text-neutral-500">
          {range.from} → {range.to}
          {(preset === 'current_week' || preset === 'current_month' || preset === 'current_year') && (
            <span className="ml-1 text-neutral-400">(as of today)</span>
          )}
        </span>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
          <label className="flex items-center gap-1">
            From
            <input
              type="date"
              value={editingFrom}
              onChange={(e) => setEditingFrom(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            To
            <input
              type="date"
              value={editingTo}
              onChange={(e) => setEditingTo(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-2 py-1"
            />
          </label>
          <button
            type="button"
            onClick={() => onChange('custom', editingFrom, editingTo)}
            disabled={!editingFrom || !editingTo || editingFrom > editingTo}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

function PrimaryPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {label}
    </button>
  )
}
