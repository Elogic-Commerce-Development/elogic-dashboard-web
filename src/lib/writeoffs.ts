/**
 * §4.4's cuts of the write-off views — the Write-offs-page sibling of
 * `lib/estimation.ts` / `lib/quality.ts`.
 *
 * Every hour and every percentage arrives already computed by
 * `v_metric_writeoff_by_{month,project,segment}`. What happens here is folding
 * rows together — and the fold is the whole reason this module exists, because
 * there is exactly one way to combine two write-off rows correctly and several
 * ways to do it wrong.
 */

import type { WriteoffMonthRow, WriteoffProjectRow, WriteoffSegmentRow } from './queries'
import { COST_OF_SALE_WORK_MODEL, isPartialMonth } from './writeoffPolicy'

/**
 * Combine write-off rows the only correct way: **sum the hours, then divide**.
 *
 * Averaging the percentages instead would weight a 306h internal project the
 * same as a 7,451h maintenance engagement. The all-time views already round
 * each row to 1dp, so a re-summed total drifts by tenths (parity-report D7) —
 * immaterial to a percentage, which is all this returns.
 *
 * The denominator is billable + non-billable only. Jira's untagged hours are
 * never silently counted as billable (§1.3 / §4.4), which is why they are
 * carried through as their own total rather than folded in.
 */
export type WriteoffFold = {
  non_billable_hours: number
  billable_hours: number
  untagged_hours: number
  total_hours: number
  writeoff_pct: number | null
}

type Foldable = {
  non_billable_hours: number
  billable_hours: number
  untagged_hours: number
  total_hours: number
}

export function foldWriteoff(rows: Foldable[]): WriteoffFold {
  const nb = rows.reduce((s, r) => s + r.non_billable_hours, 0)
  const b = rows.reduce((s, r) => s + r.billable_hours, 0)
  const untagged = rows.reduce((s, r) => s + r.untagged_hours, 0)
  const total = rows.reduce((s, r) => s + r.total_hours, 0)
  const denom = nb + b
  return {
    non_billable_hours: nb,
    billable_hours: b,
    untagged_hours: untagged,
    total_hours: total,
    writeoff_pct: denom > 0 ? (nb / denom) * 100 : null,
  }
}

/** One point on §4.4's monthly chart. */
export type WriteoffMonth = {
  month: string
  /** Whole company — the population §5's 8.8% baseline is pinned against. */
  company_pct: number | null
  /** The 65 in-scope delivery projects. */
  in_scope_pct: number | null
  company_non_billable: number
  company_billable: number
  in_scope_non_billable: number
  untagged_hours: number
  /** True for a month whose last day has not happened yet — see writeoffPolicy. */
  partial: boolean
}

/**
 * Fold the view's two rows per month (in-scope / out) into the two series
 * §4.4's chart draws. Called once, here, so the "sum then divide" rule cannot
 * be re-implemented differently by a second caller.
 */
export function foldWriteoffMonths(
  rows: WriteoffMonthRow[],
  today: Date = new Date(),
): WriteoffMonth[] {
  const byMonth = new Map<string, WriteoffMonthRow[]>()
  for (const r of rows) {
    const bucket = byMonth.get(r.month)
    if (bucket) bucket.push(r)
    else byMonth.set(r.month, [r])
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, monthRows]) => {
      const company = foldWriteoff(monthRows)
      const inScope = foldWriteoff(monthRows.filter((r) => r.is_in_scope))
      return {
        month,
        company_pct: company.writeoff_pct,
        in_scope_pct: inScope.writeoff_pct,
        company_non_billable: company.non_billable_hours,
        company_billable: company.billable_hours,
        in_scope_non_billable: inScope.non_billable_hours,
        untagged_hours: company.untagged_hours,
        partial: isPartialMonth(month, today),
      }
    })
}

/**
 * §4.4: "cost-of-sale (Pre-sales, 976h/22 people) split out from write-offs —
 * different phenomenon, different judgment".
 *
 * Delivery work and internal work are two populations with two meanings.
 * Non-billable hours on a client engagement are hours we ate; non-billable
 * hours on "Pre-sales requests & Estimations" are the cost of winning work,
 * and a page that adds them together tells a manager to go fix pre-sales for
 * doing its job. The split is by the owner's own S2b `work_model` tag rather
 * than a project-name match.
 */
export type WriteoffSplit = {
  delivery: WriteoffFold
  costOfSale: WriteoffFold
  costOfSaleProjects: WriteoffProjectRow[]
}

export function splitCostOfSale(rows: WriteoffProjectRow[]): WriteoffSplit {
  const costOfSaleProjects = rows
    .filter((r) => r.work_model === COST_OF_SALE_WORK_MODEL)
    .sort((a, b) => b.non_billable_hours - a.non_billable_hours)
  return {
    delivery: foldWriteoff(rows.filter((r) => r.work_model !== COST_OF_SALE_WORK_MODEL)),
    costOfSale: foldWriteoff(costOfSaleProjects),
    costOfSaleProjects,
  }
}

/** §4.4's headline tiles: company / in-scope / out-of-scope, from one source. */
export type WriteoffHeadline = {
  company: WriteoffFold
  inScope: WriteoffFold
  outOfScope: WriteoffFold
}

export function summariseWriteoff(rows: WriteoffProjectRow[]): WriteoffHeadline {
  return {
    company: foldWriteoff(rows),
    inScope: foldWriteoff(rows.filter((r) => r.is_in_scope)),
    outOfScope: foldWriteoff(rows.filter((r) => !r.is_in_scope)),
  }
}

/**
 * The trailing baseline a month is judged against — `v_metric_config`'s
 * `writeoff_baseline_months` is 6, and §4.1's drift signal is "+5pts vs
 * trailing 6-month baseline".
 *
 * Partial months are excluded first: a half-finished month would drag the very
 * line it is being compared to. The window is then the last `windowMonths`
 * **closed** months — `slice(-windowMonths)`, not `slice(-windowMonths - 1, -1)`,
 * which was the first cut and silently dropped the most recent closed month.
 * That `-1` end index is only correct against an array whose last element is
 * the partial month; against an already-partial-free array it discards real
 * data and reaches a month further back to compensate. Caught by adversarial
 * review; the figure moved 9.6% → 9.1%.
 *
 * Returns null when there are not enough closed months to form a window, rather
 * than quietly averaging two.
 */
export function trailingBaseline(
  months: WriteoffMonth[],
  windowMonths = 6,
  minMonths = 3,
): number | null {
  const closed = months.filter((m) => !m.partial && m.company_non_billable + m.company_billable > 0)
  const window = closed.slice(-windowMonths)
  if (window.length < minMonths) return null
  const nb = window.reduce((s, m) => s + m.company_non_billable, 0)
  const b = window.reduce((s, m) => s + m.company_billable, 0)
  return nb + b > 0 ? (nb / (nb + b)) * 100 : null
}

/** Segment rows for the in-scope delivery segments, biggest write-off first. */
export function deliverySegments(rows: WriteoffSegmentRow[]): WriteoffSegmentRow[] {
  return rows
    .filter((r) => r.is_in_scope)
    .sort((a, b) => b.non_billable_hours - a.non_billable_hours)
}
