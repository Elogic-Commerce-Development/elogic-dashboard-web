import { Link } from '@tanstack/react-router'
import type { TaskTimeEntry } from '@/lib/queries'
import { formatHours } from '@/lib/format'
import { jobTypeColor, NO_JOB_TYPE_LABEL } from '@/lib/jobTypes'

type Props = {
  entries: TaskTimeEntry[]
  /** user_id → hex colour, computed once at the page level so the dot
   *  matches the chart's "By employee" segment for the same person. */
  employeeColors: Map<number, string>
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

function formatRecordDate(iso: string): string {
  // record_date is stored as a plain DATE; parsing as UTC midnight and
  // formatting in the local zone is fine — there's no time component.
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return iso
  return DATE_FMT.format(d)
}

/** AC enum: 0=not billable, 1=billable, 2=already billed, 3=pending payment */
function billableLabel(status: number | null): { text: string; tone: 'good' | 'neutral' | 'info' | 'warn' } {
  switch (status) {
    case 1:
      return { text: 'Billable', tone: 'good' }
    case 2:
      return { text: 'Already billed', tone: 'info' }
    case 3:
      return { text: 'Pending payment', tone: 'warn' }
    case 0:
      return { text: 'Not billable', tone: 'neutral' }
    default:
      return { text: '—', tone: 'neutral' }
  }
}

const TONE_CHIP: Record<'good' | 'neutral' | 'info' | 'warn', string> = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  neutral: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
}

export function TaskTimeEntries({ entries, employeeColors }: Props) {
  if (entries.length === 0) return null

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-neutral-900">
        Time entries ({entries.length})
      </h3>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Hours</th>
                <th className="px-4 py-2 font-medium">Person</th>
                <th className="px-4 py-2 font-medium">Job type</th>
                <th className="px-4 py-2 font-medium">Billable</th>
                <th className="px-4 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const personColor = employeeColors.get(e.user_id) ?? '#475569'
                const jtColor = jobTypeColor(e.job_type_name)
                const bill = billableLabel(e.billable_status)
                return (
                  <tr key={e.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-700">
                      {formatRecordDate(e.record_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-neutral-900">
                      {formatHours(e.hours)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: personColor }}
                        />
                        <Link
                          to="/people/$userId"
                          params={{ userId: String(e.user_id) }}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {e.user_name}
                        </Link>
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: jtColor }}
                        />
                        <span className="text-neutral-700">{e.job_type_name ?? NO_JOB_TYPE_LABEL}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_CHIP[bill.tone]}`}
                      >
                        {bill.text}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      <span className="line-clamp-1" title={e.summary ?? undefined}>
                        {e.summary ?? ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
