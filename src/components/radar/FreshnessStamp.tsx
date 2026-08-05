import { useEffect, useState } from 'react'
import { fetchSyncStatus, type SyncStatusRow } from '@/lib/queries'
import { formatDateTime } from '@/lib/format'

const HOUR_MS = 60 * 60 * 1000

function ageLabel(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS)
  if (hours < 1) return 'less than an hour ago'
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/**
 * §4.1: "Radar carries a data-freshness stamp prominently (last sync time,
 * amber past 24h): a daily-glance early-warning page whose sync runs from the
 * operator's laptop (until Phase 3's hosted scheduler) must wear its staleness
 * on its face."
 *
 * Reads `v_sync_status` — the same row the header badge reads, deliberately:
 * two different freshness claims on one screen would be worse than none.
 * Wall-clock age is computed in the effect, off the render path, so render
 * stays pure (same rule as SyncStatusBadge).
 */
export function FreshnessStamp() {
  const [status, setStatus] = useState<SyncStatusRow | null>(null)
  const [age, setAge] = useState<{ label: string; stale: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSyncStatus()
      .then((row) => {
        if (cancelled) return
        setStatus(row)
        const last = row?.last_successful_sync ?? null
        if (last) {
          const ms = Date.now() - new Date(last).getTime()
          setAge({ label: ageLabel(ms), stale: ms > 24 * HOUR_MS })
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        Freshness unknown — sync status unavailable ({error}).
      </div>
    )
  }

  const stale = age?.stale ?? false
  const tone = !status
    ? 'border-neutral-200 bg-white text-neutral-500'
    : stale
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900'

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs ${tone}`}>
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
          !status ? 'bg-neutral-300' : stale ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
        aria-hidden
      />
      <span className="font-medium">
        Data as of {formatDateTime(status?.last_successful_sync ?? null)}
      </span>
      {age ? <span className="opacity-80">({age.label})</span> : null}
      {status ? (
        <span className="opacity-70">
          · {status.task_count.toLocaleString()} tasks · {status.time_record_count.toLocaleString()} time
          records
        </span>
      ) : null}
      {stale ? (
        <span className="font-medium">
          · Stale — the sync runs from the operator&rsquo;s laptop and has not completed in over 24h.
        </span>
      ) : null}
    </div>
  )
}
