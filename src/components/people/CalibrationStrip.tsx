import type { PersonCalibration } from '@/lib/queries'

/**
 * §4.5: "The distribution views (e.g. calibration spread) render as **strips
 * with the person highlighted, not ranked tables**."
 *
 * That instruction is the whole design. A ranked table of people by median
 * ratio is a leaderboard, and a leaderboard answers "who is worst" — the
 * question §2.5 forbids this page from asking. A strip answers "where does
 * this person sit among their peers", which is the question a 1:1 actually
 * needs. Nobody else is named: the other marks are anonymous, so the strip
 * gives context without inviting comparison shopping.
 *
 * Only people at or above §5's sample floor are plotted — the same
 * suppression the cards apply, for the same reason.
 */
export function CalibrationStrip({
  all,
  highlightUserId,
  floor,
}: {
  all: PersonCalibration[]
  highlightUserId: number
  floor: number
}) {
  const plotted = all.filter(
    (c) => c.meets_sample_floor && c.n >= floor && c.median_ratio != null,
  )
  if (plotted.length < 3) return null

  // Ratios are unbounded above; clamp the axis at 3.0 so one 12× outlier does
  // not squash everyone else into a single pixel. Anything beyond pins to the
  // end and says so.
  const MAX = 3
  const x = (r: number) => Math.min(r, MAX) / MAX

  const me = plotted.find((c) => c.user_id === highlightUserId)
  const myMedian = me?.median_ratio ?? null
  const sorted = [...plotted].map((c) => c.median_ratio as number).sort((a, b) => a - b)
  const rank = myMedian == null ? null : sorted.filter((v) => v < myMedian).length

  return (
    <div className="space-y-1.5">
      <div className="relative h-9">
        {/* the in-band window (0.8–1.2), the only "good" region §5 defines */}
        <div
          className="absolute top-2 h-5 rounded bg-emerald-100"
          style={{ left: `${x(0.8) * 100}%`, width: `${(x(1.2) - x(0.8)) * 100}%` }}
        />
        <div className="absolute top-2 h-5 w-px bg-neutral-300" style={{ left: `${x(1) * 100}%` }} />

        {plotted.map((c) => {
          const isMe = c.user_id === highlightUserId
          return (
            <span
              key={c.user_id}
              className={
                isMe
                  ? 'absolute top-1 h-7 w-[3px] -translate-x-1/2 rounded-full bg-blue-600'
                  : 'absolute top-3 h-3 w-px -translate-x-1/2 rounded-full bg-neutral-400/70'
              }
              style={{ left: `${x(c.median_ratio as number) * 100}%` }}
              title={isMe ? `This person: median ${(c.median_ratio as number).toFixed(2)}` : undefined}
            />
          )
        })}
      </div>

      <div className="flex justify-between text-[10px] tabular-nums text-neutral-400">
        <span>0</span>
        <span>1.0 — estimate met</span>
        <span>3.0+</span>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-500">
        Each mark is one colleague&rsquo;s median ratio; {plotted.length} people clear the n ≥ {floor}{' '}
        floor. The green band is the 0.8–1.2 in-band window.{' '}
        {myMedian != null && rank != null ? (
          <>
            This person sits at <span className="font-medium text-blue-700">{myMedian.toFixed(2)}</span>,
            with {rank} of {plotted.length - 1} peers below them. Position is context for a
            conversation, not a ranking — the peers are deliberately unnamed.
          </>
        ) : (
          <>This person is not plotted: their sample is below the floor.</>
        )}
      </p>
    </div>
  )
}
