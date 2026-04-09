export function TrackingSinceBanner() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      This dashboard tracks tasks created on or after{' '}
      <span className="font-semibold">2025-01-01</span>. Time records, comments, and
      estimates from before that date are not included.
    </div>
  )
}
