import type { UtilizationSummary } from '@/lib/utilization'

type Props = { summary: UtilizationSummary }

type Card = {
  label: string
  primary: string
  secondary?: string
  tone?: 'good' | 'bad' | 'warn' | 'info' | 'neutral' | 'alert'
}

const TONE_STYLES: Record<NonNullable<Card['tone']>, string> = {
  good: 'border-emerald-200 bg-emerald-50',
  bad: 'border-red-200 bg-red-50',
  warn: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
  alert: 'border-pink-200 bg-pink-50',
  neutral: 'border-neutral-200 bg-white',
}

export function UtilizationSummaryCards({ summary }: Props) {
  const cards: Card[] = [
    {
      label: 'Tracked',
      primary: `${summary.trackedHours.toFixed(1)}h`,
      secondary: summary.expectedHours > 0
        ? `${Math.round((summary.trackedHours / summary.expectedHours) * 100)}% of expected`
        : '—',
      tone: 'good',
    },
    {
      label: 'Expected',
      primary: `${summary.expectedHours.toFixed(1)}h`,
      secondary: `${summary.workingDayCount} working days`,
      tone: 'neutral',
    },
    {
      label: 'Untracked working',
      primary: `${summary.untrackedWorkingHours.toFixed(1)}h`,
      secondary: summary.untrackedWorkingHours > 0 ? 'gap vs expected' : 'no gap',
      tone: summary.untrackedWorkingHours > 0 ? 'bad' : 'neutral',
    },
    {
      label: 'Vacation',
      primary: `${summary.buckets.vacation.toFixed(1)}h`,
      secondary: `${summary.vacationDayCount} days`,
      tone: 'info',
    },
    {
      label: 'Sick leave',
      primary: `${summary.buckets.sick.toFixed(1)}h`,
      secondary: `${summary.sickDayCount} days`,
      tone: 'warn',
    },
    {
      label: 'Public holidays',
      primary: `${summary.buckets.holiday.toFixed(1)}h`,
      secondary: `${summary.holidayDayCount} days`,
      tone: 'info',
    },
    {
      label: 'Weekends',
      primary: `${summary.buckets.weekend.toFixed(1)}h`,
      secondary: `${summary.weekendDayCount} days`,
      tone: 'neutral',
    },
    {
      label: 'WFH (informational)',
      primary: `${summary.wfhDayCount}`,
      secondary: 'days marked WFH',
      tone: 'neutral',
    },
  ]

  if (summary.benchDayCount > 0 || summary.buckets.bench > 0) {
    cards.push({
      label: 'Bench',
      primary: `${summary.buckets.bench.toFixed(1)}h`,
      secondary: `${summary.benchDayCount} days`,
      tone: 'info',
    })
  }
  if (summary.overTrackedHours > 0) {
    cards.push({
      label: 'Tracked above plan',
      primary: `${summary.overTrackedHours.toFixed(1)}h`,
      secondary: 'logged beyond expected',
      tone: 'alert',
    })
  }
  if (summary.unmappedLeaveHours > 0 || summary.unmappedLeaveDayCount > 0) {
    cards.push({
      label: 'Unmapped leave',
      primary: `${summary.unmappedLeaveHours.toFixed(1)}h`,
      secondary: `${summary.unmappedLeaveDayCount} days · needs mapping`,
      tone: 'warn',
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-lg border p-3 shadow-sm ${TONE_STYLES[c.tone ?? 'neutral']}`}
        >
          <div className="text-[11px] uppercase tracking-wider text-neutral-500">{c.label}</div>
          <div className="mt-0.5 text-xl font-semibold text-neutral-900 tabular-nums">{c.primary}</div>
          {c.secondary && <div className="text-xs text-neutral-500">{c.secondary}</div>}
        </div>
      ))}
    </div>
  )
}
