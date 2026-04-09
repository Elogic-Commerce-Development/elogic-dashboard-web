import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { defaultFilters, type Filters } from '@/lib/filters'
import { FilterBar } from './FilterBar'
import { SyncStatusBadge } from './SyncStatusBadge'
import { TrackingSinceBanner } from './TrackingSinceBanner'
import { TasksWithoutEstimatesTable } from './metrics/TasksWithoutEstimatesTable'
import { OverrunTable } from './metrics/OverrunTable'
import { EstimateVsActualTable } from './metrics/EstimateVsActualTable'
import { AccuracyByUserTable } from './metrics/AccuracyByUserTable'
import { AccuracyByProjectTable } from './metrics/AccuracyByProjectTable'

type Tab = 'overview' | 'estimates' | 'people'

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'estimates', label: 'Estimates' },
  { id: 'people', label: 'People' },
]

export function AppShell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [filters, setFilters] = useState<Filters>(defaultFilters)

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-neutral-900">Elogic Dashboard</h1>
            <nav className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    tab === t.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <SyncStatusBadge />
            <span className="text-xs text-neutral-400">{email}</span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-6 py-6">
        <TrackingSinceBanner />
        <FilterBar value={filters} onChange={setFilters} />

        {tab === 'overview' && (
          <div className="space-y-6">
            <Section title="Tasks without estimates" description="Open, in-progress tasks that need sizing.">
              <TasksWithoutEstimatesTable filters={filters} />
            </Section>
            <Section title="Tasks overrun" description="Completed tasks where actual hours exceeded the estimate.">
              <OverrunTable filters={filters} />
            </Section>
          </div>
        )}

        {tab === 'estimates' && (
          <div className="space-y-6">
            <Section title="Estimate vs actual" description="Every task with an estimate, sorted by creation date.">
              <EstimateVsActualTable filters={filters} />
            </Section>
          </div>
        )}

        {tab === 'people' && (
          <div className="space-y-6">
            <Section title="Accuracy by user" description="Completed tasks only. Median is a better headline than mean.">
              <AccuracyByUserTable filters={filters} />
            </Section>
            <Section title="Accuracy by project" description="Completed tasks only.">
              <AccuracyByProjectTable filters={filters} />
            </Section>
          </div>
        )}
      </main>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
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
