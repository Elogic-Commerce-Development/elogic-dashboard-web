export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)}h`
}

export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const pct = Math.round(Number(value) * 100)
  return `${pct}%`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
