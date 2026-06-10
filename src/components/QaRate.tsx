/**
 * Renders a QA rate (Bugs Rate / Return Rate): the average with one decimal
 * plus the sample size, e.g. "2.3 (12)". The average covers labeled tasks
 * only, so the sample size is what makes the number honest — a 5.0 over one
 * task is noise, over twenty it's a signal.
 *
 * Thresholds mirror the Quality signals targets (bugs: 0, iterations: 1).
 */
export function QaRate({
  value,
  sampleSize,
  kind,
}: {
  value: number | null
  sampleSize: number
  kind: 'bugs' | 'iterations'
}) {
  if (value == null || sampleSize === 0) return <span className="text-neutral-400">—</span>
  const v = Number(value)
  const warn = kind === 'bugs' ? v > 0 : v > 1
  const cls = v > 2 ? 'text-red-600 font-medium' : warn ? 'text-amber-600' : ''
  return (
    <span className={cls}>
      {v.toFixed(1)} <span className="font-normal text-neutral-400">({sampleSize})</span>
    </span>
  )
}
