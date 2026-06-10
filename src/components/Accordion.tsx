import type { ReactNode } from 'react'

/**
 * Controlled collapsible section, visually matching the Quality signals
 * header-button pattern on the dashboard. State lives in the parent so other
 * UI (e.g. the project page KPI cards) can force a section open.
 */
export function Accordion({
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  title: string
  meta?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50 ${
          open ? 'border-b border-neutral-100' : ''
        }`}
      >
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {meta && <span className="text-xs text-neutral-500">{meta}</span>}
        </div>
        <span className="shrink-0 text-neutral-400" aria-hidden="true">
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </section>
  )
}
