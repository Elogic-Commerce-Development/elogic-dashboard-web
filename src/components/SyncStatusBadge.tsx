import { useEffect, useState } from 'react'
import { fetchSyncStatus, type SyncStatusRow } from '@/lib/queries'
import { formatDateTime } from '@/lib/format'

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatusRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSyncStatus()
      .then((row) => {
        if (cancelled) return
        setStatus(row)
        // Staleness depends on the wall clock; compute it here in the effect
        // (off the render path) so render stays pure — no Date.now() in render.
        const last = row?.last_successful_sync ?? null
        setIsStale(last !== null && Date.now() - new Date(last).getTime() > 24 * 60 * 60 * 1000)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <span className="text-xs text-red-600">sync status unavailable</span>
  }

  if (!status) {
    return <span className="text-xs text-neutral-400">Loading…</span>
  }

  const last = status.last_successful_sync

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-600">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          last === null ? 'bg-neutral-300' : isStale ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
        aria-hidden
      />
      <span>
        Last synced: <span className="font-medium text-neutral-900">{formatDateTime(last)}</span>
      </span>
      <span className="text-neutral-400">·</span>
      <span>
        {status.task_count.toLocaleString()} tasks · {status.time_record_count.toLocaleString()} time records
      </span>
    </div>
  )
}
