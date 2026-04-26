import type { UtilizationSummary } from '@/lib/utilization'

type Props = { summary: UtilizationSummary }

type Card = {
  label: string
  primary: string
  secondary?: string
  tone?: 'good' | 'bad' | 'warn' | 'info' | 'neutral' | 'alert' | 'emphasis'
}

const TONE_STYLES: Record<NonNullable<Card['tone']>, string> = {
  good: 'border-emerald-200 bg-emerald-50',
  bad: 'border-red-200 bg-red-50',
  warn: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
  alert: 'border-pink-200 bg-pink-50',
  neutral: 'border-neutral-200 bg-white',
  emphasis: 'border-neutral-300 bg-neutral-100',
}

export function UtilizationSummaryCards({ summary }: Props) {
  const cards: Card[] = [
    {
      label: 'Working hours',
      primary: `${summary.workingHours.toFixed(1)}h`,
      secondary: `${summary.workingDayCount} days · weekends + ${summary.holidayDayCount} holiday(s) excluded`,
      tone: 'emphasis',
    },
    {
      label: 'Tracked',
      primary: `${summary.trackedHours.toFixed(1)}h`,
      secondary: summary.workingHours > 0
        ? `${Math.round((summary.trackedHours / summary.workingHours) * 100)}% of working hours`
        : '—',
      tone: 'good',
    },
    {
      label: 'Missing',
      primary: `${summary.missingHours.toFixed(1)}h`,
      secondary: summary.missingHours > 0 ? 'expected but not logged' : 'nothing missing',
      tone: summary.missingHours > 0 ? 'bad' : 'neutral',
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
      label: 'Unpaid leave',
      primary: `${summary.buckets.unpaid_leave.toFixed(1)}h`,
      secondary: `${summary.unpaidLeaveDayCount} days`,
      tone: 'neutral',
    },
    {
      label: 'Other absence',
      primary: `${summary.buckets.other_absence.toFixed(1)}h`,
      secondary: `${summary.otherAbsenceDayCount} days · bench / other paid`,
      tone: summary.buckets.other_absence > 0 ? 'info' : 'neutral',
    },
    {
      label: 'WFH (informational)',
      primary: `${summary.wfhDayCount}`,
      secondary: 'days marked WFH',
      tone: 'neutral',
    },
  ]

  if (summary.overTrackedHours > 0) {
    cards.push({
      label: 'Tracked above plan',
      primary: `${summary.overTrackedHours.toFixed(1)}h`,
      secondary: 'logged beyond expected (e.g. weekend / holiday work)',
      tone: 'alert',
    })
  }
  if (summary.unmappedLeaveHours > 0) {
    cards.push({
      label: 'Unmapped leave',
      primary: `${summary.unmappedLeaveHours.toFixed(1)}h`,
      secondary: 'policy needs operator mapping',
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
