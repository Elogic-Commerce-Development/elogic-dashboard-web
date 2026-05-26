/**
 * Distribution helpers. Pure functions, no dependencies.
 *
 * All return `null` for empty input — callers display an empty state rather
 * than rendering an arbitrary value. Even-count median averages the two
 * middle values (proper definition, not the upper middle).
 */

export function median(xs: number[]): number | null {
  return percentile(xs, 0.5)
}

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null
  let sum = 0
  for (const x of xs) sum += x
  return sum / xs.length
}

/**
 * Linear-interpolation percentile (matches Postgres `percentile_cont`).
 * p is in [0, 1]. Sort is non-mutating.
 */
export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null
  const sorted = [...xs].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
