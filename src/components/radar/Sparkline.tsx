/**
 * A 60×18 trend line. Inline SVG on purpose — Recharts is already in the
 * bundle for the analysis charts, but a Radar row can carry twenty of these
 * and the page's promise is a daily glance that renders instantly
 * (.impeccable.md: "no animation that makes the user wait").
 *
 * The last point is drawn hollow when it is a partial period, because the
 * current month always dips and a solid dot reads as a collapse.
 */
export function Sparkline({
  values,
  width = 60,
  height = 18,
  tone = 'neutral',
  lastIsPartial = false,
  title,
}: {
  values: number[]
  width?: number
  height?: number
  tone?: 'neutral' | 'red' | 'emerald'
  lastIsPartial?: boolean
  title?: string
}) {
  const usable = values.filter((v) => Number.isFinite(v))
  if (usable.length < 2) {
    return <span className="text-[10px] text-neutral-400">no trend</span>
  }

  const max = Math.max(...usable)
  const min = Math.min(...usable)
  const span = max - min || 1
  const stepX = width / (usable.length - 1)
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2)

  const points = usable.map((v, i) => `${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const lastX = (usable.length - 1) * stepX
  const lastY = y(usable[usable.length - 1])

  const stroke =
    tone === 'red' ? 'stroke-red-500' : tone === 'emerald' ? 'stroke-emerald-500' : 'stroke-neutral-400'
  const fill =
    tone === 'red' ? 'fill-red-500' : tone === 'emerald' ? 'fill-emerald-500' : 'fill-neutral-500'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={title ?? 'trend'}
    >
      {title ? <title>{title}</title> : null}
      <polyline points={points} className={`${stroke} fill-none`} strokeWidth={1.25} />
      <circle
        cx={lastX}
        cy={lastY}
        r={1.75}
        className={lastIsPartial ? `${stroke} fill-white` : fill}
        strokeWidth={lastIsPartial ? 1 : 0}
      />
    </svg>
  )
}
