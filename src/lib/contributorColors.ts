/**
 * Sequential slate shades used to colour-code per-employee segments on
 * task-detail visualisations (the chart bar AND the entries table). Slate
 * is intentionally cool/neutral so it doesn't compete with the job-type
 * categorical colours, which carry semantic meaning.
 *
 * The mapping is per-task: the contributor with the most hours gets the
 * darkest shade, the next gets the next-darkest, and so on. This keeps the
 * chart and the table consistent (same person → same colour).
 */

export const EMPLOYEE_SHADES = [
  '#1e293b', // slate-800
  '#334155', // slate-700
  '#475569', // slate-600
  '#64748b', // slate-500
  '#94a3b8', // slate-400
  '#cbd5e1', // slate-300
]

/**
 * Build a per-task user_id → hex-colour map. Order is by total hours
 * descending so the heaviest contributor is always the most prominent.
 */
export function buildEmployeeColorMap(
  rows: ReadonlyArray<{ user_id: number; hours: number }>,
): Map<number, string> {
  const totals = new Map<number, number>()
  for (const r of rows) {
    totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.hours)
  }
  const ordered = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  const map = new Map<number, string>()
  ordered.forEach(([uid], i) => map.set(uid, EMPLOYEE_SHADES[i % EMPLOYEE_SHADES.length]))
  return map
}
