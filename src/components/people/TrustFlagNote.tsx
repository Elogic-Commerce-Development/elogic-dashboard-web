import { TRUST_FLAG_CAVEAT, type TrustFlag } from '@/lib/peopleCoaching'

/**
 * §4.5's trust flag, rendered in the register §9 requires: "framing on cards
 * stays behavioral (*timesheet mirrors estimate — is tracking real?*), never
 * accusatory."
 *
 * The visual grammar is deliberately **not** the red alarm the rest of the
 * dashboard uses for bad numbers. This is not a bad number; it is a question
 * about whether a number means what it appears to mean. Red would make it a
 * verdict before anyone read a word, which is the failure mode §1.3 warns
 * about ("the dashboard coaches the gaming, not the estimating"). Amber, a
 * question-mark glyph, and a heading that is literally a question.
 *
 * Order is load-bearing too: **observation → reading → question → caveat.**
 * What was measured comes first, what it might mean is hedged, and the last
 * word is what to ask the person — never a conclusion about them.
 */
export function TrustFlagNote({ flag, compact = false }: { flag: TrustFlag; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white"
        >
          ?
        </span>
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold text-amber-900">{flag.headline}</p>

          <p className="text-[11px] leading-relaxed text-amber-900/90">{flag.observation}</p>

          {!compact && (
            <p className="text-[11px] leading-relaxed text-amber-900/80">{flag.reading}</p>
          )}

          <p className="text-[11px] leading-relaxed text-amber-900">
            <span className="font-medium">Worth asking:</span>{' '}
            <span className="italic">“{flag.question}”</span>
          </p>

          {!compact && (
            <p className="text-[10px] leading-relaxed text-amber-800/70">{TRUST_FLAG_CAVEAT}</p>
          )}
        </div>
      </div>
    </div>
  )
}
