import type { ProjectSignals } from '@/lib/queries'
import { firingSignals } from '@/lib/radarSignals'
import { formatHours } from '@/lib/format'

/**
 * §4.7's "firing-signal banner (from Radar)" — the same signals row and the
 * same sentences the attention queue renders, so the two pages can never
 * disagree about what is burning on a project.
 *
 * The three states are deliberately distinct (F3/F5 lesson): loading and
 * failure must never read as "nothing is firing", because on an early-warning
 * surface silence is the one message that must be earned.
 */
export function SignalBanner({
  signals,
  loading,
  error,
}: {
  signals: ProjectSignals | null
  loading: boolean
  error?: string
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-400">
        Checking Radar signals…
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span className="font-medium">Radar signals could not be loaded.</span> This is not an
        all-clear — no signal was evaluated. <code className="text-xs">{error}</code>
      </div>
    )
  }
  if (!signals) return null // out of scope — the page states that itself

  const firing = firingSignals(signals)
  if (firing.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
        No Radar signal is firing on this project right now.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="text-sm font-semibold text-amber-900">
        {firing.length === 1 ? '1 Radar signal firing' : `${firing.length} Radar signals firing`}
        <span className="ml-2 font-normal text-amber-800">
          · {formatHours(firing.reduce((s, f) => s + f.hours, 0))} at risk
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {firing.map((f) => (
          <li key={f.key} className="flex items-baseline gap-2 text-xs leading-relaxed">
            <span
              className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                f.tone === 'red' ? 'bg-red-500' : 'bg-amber-500'
              }`}
            />
            <span>
              <span className={`font-semibold ${f.tone === 'red' ? 'text-red-700' : 'text-amber-800'}`}>
                {f.label}:
              </span>{' '}
              <span className="text-neutral-700">{f.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
