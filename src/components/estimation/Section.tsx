import type { ReactNode } from 'react'

/**
 * The Estimation page's shared furniture.
 *
 * Deliberately the same shapes F3 established on Radar (bordered white panel,
 * header with a blurb on the left and a counter on the right, a red failure
 * state that says it is *not* an all-clear) — .impeccable.md's "reuse before
 * invention", and, more concretely, the reason a reader can tell at a glance
 * whether a block is empty or broken.
 */

export function Block({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <p className="max-w-4xl text-xs leading-relaxed text-neutral-500">{blurb}</p>
      {children}
    </section>
  )
}

export function Panel({
  title,
  blurb,
  meta,
  children,
}: {
  title: string
  blurb?: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-200 px-3 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {blurb ? <p className="text-xs text-neutral-500">{blurb}</p> : null}
        </div>
        {meta ? <span className="text-xs tabular-nums text-neutral-500">{meta}</span> : null}
      </header>
      <div>{children}</div>
    </section>
  )
}

/**
 * A section that failed to load must never render its empty state — F3's
 * deployed pass caught exactly that ("No project is firing a signal. That is
 * the healthy state" printed over a failed query), and this page has the same
 * hazard: 0h of unestimated work would be excellent news.
 */
export function LoadFailure({ what, error }: { what: string; error: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="font-medium">{what} could not be loaded.</span> Nothing here was measured —
      this is not a zero. <code className="text-xs">{error}</code>
    </div>
  )
}

export function Loading({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
      Loading {what}…
    </div>
  )
}

export type Tone = 'red' | 'amber' | 'emerald' | 'neutral'

const TONE_VALUE: Record<Tone, string> = {
  red: 'text-red-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  neutral: 'text-neutral-900',
}

/**
 * "Numbers are the hero" (.impeccable.md #1): the figure is the largest thing
 * in the tile, the label sits under it, and the caption carries the definition
 * so nobody has to guess what the denominator was.
 */
export function StatTile({
  label,
  value,
  caption,
  tone = 'neutral',
  emphasis = false,
}: {
  label: string
  value: string
  caption?: ReactNode
  tone?: Tone
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-lg border bg-white px-3 py-2.5 ${
        emphasis ? 'border-neutral-300 shadow-sm' : 'border-neutral-200'
      }`}
    >
      <div
        className={`tabular-nums font-bold ${emphasis ? 'text-2xl' : 'text-xl'} ${TONE_VALUE[tone]}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-neutral-700">{label}</div>
      {caption ? <div className="mt-1 text-[11px] leading-snug text-neutral-500">{caption}</div> : null}
    </div>
  )
}

/** Small neutral pill used for segment / rate-band metadata inside tables. */
export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600"
    >
      {children}
    </span>
  )
}
