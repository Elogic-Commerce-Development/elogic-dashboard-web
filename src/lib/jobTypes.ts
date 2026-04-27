/**
 * Stable color palette for ActiveCollab job types — used everywhere a
 * visualisation segments time by job_type so the same job always reads as
 * the same colour across the dashboard (legend recognition).
 *
 * Discovery from the AC tenant gave 15 job types. They cluster into
 * families that share a hue, with shade differences within the family:
 *
 *   Engineering       (emerald variants) — Development, Frontend Development,
 *                                          Development back, Code Review
 *   QA / Testing      (amber variants)   — QA, Testing
 *   Design            violet
 *   Business analysis blue
 *   Management        cyan
 *   DevOps            slate
 *   Research          indigo variants    — Research, Growth Research
 *   Overtime          rose               — visually flags out-of-band hours
 *   Other / unmapped  neutral            — Other, No Tasks, null/unknown
 *
 * Add new job types to JOB_TYPE_COLORS as they appear; the fallback colour
 * keeps everything renderable without code changes.
 */

export const JOB_TYPE_COLORS: Record<string, string> = {
  // Engineering family — emerald shades
  'Development':           '#059669',  // emerald-600
  'Frontend Development':  '#10b981',  // emerald-500
  'Development back':      '#047857',  // emerald-700
  'Code Review':           '#34d399',  // emerald-400

  // QA / Testing family — amber shades
  'QA':                    '#d97706',  // amber-600
  'Testing':               '#f59e0b',  // amber-500

  // Design — violet
  'Design':                '#7c3aed',  // violet-600

  // Business analysis — blue
  'BA':                    '#2563eb',  // blue-600

  // Management — cyan
  'Management':            '#0891b2',  // cyan-600

  // DevOps — slate
  'Dev Ops':               '#475569',  // slate-600

  // Research family — indigo shades
  'Research':              '#6366f1',  // indigo-500
  'Growth Research':       '#4f46e5',  // indigo-600

  // Overtime — rose (alert-ish without being a hard error)
  'Overtime':              '#f43f5e',  // rose-500

  // Catch-alls — neutrals
  'Other':                 '#737373',  // neutral-500
  'No Tasks':              '#a3a3a3',  // neutral-400
}

/** Stable colour for unknown / unmapped / null job types. */
export const JOB_TYPE_FALLBACK_COLOR = '#a3a3a3'  // neutral-400

/** Stable colour for hours logged with no job_type at all. */
export const JOB_TYPE_NONE_COLOR = '#d4d4d4'  // neutral-300

/**
 * Resolve a colour for a given job_type label. Always returns a valid hex.
 * Pass `null` (or undefined / empty) for "no job type assigned" hours.
 */
export function jobTypeColor(name: string | null | undefined): string {
  if (name == null || name === '') return JOB_TYPE_NONE_COLOR
  return JOB_TYPE_COLORS[name] ?? JOB_TYPE_FALLBACK_COLOR
}

/**
 * Display label for the "no job type" bucket in legends.
 */
export const NO_JOB_TYPE_LABEL = '(no job type)'
