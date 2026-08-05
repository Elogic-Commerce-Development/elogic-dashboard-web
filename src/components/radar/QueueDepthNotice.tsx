import {
  QUEUE_HEALTHY_MAX,
  QUEUE_OVER_CAPACITY,
  QUEUE_TOP_N,
  queueDepthBand,
} from '@/lib/radarPolicy'

/**
 * §4.1's queue-depth policy, said in words.
 *
 * "the overflow count is itself a vital — a queue that stays above ~40 for two
 * consecutive weeks means triage capacity, not thresholds, is the problem, and
 * Radar says so in words rather than silently truncating."
 *
 * The week-over-week half of that rule needs history nobody stores yet (no
 * daily snapshot of queue depth exists), so this states today's depth and
 * names the rule instead of pretending to evaluate it.
 */
export function QueueDepthNotice({
  burning,
  approaching,
  loading,
}: {
  burning: number
  approaching: number
  loading: boolean
}) {
  const depth = burning + approaching
  const band = queueDepthBand(depth)

  if (loading) return null

  const tone =
    band === 'healthy'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : band === 'watch'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-red-200 bg-red-50 text-red-900'

  const headline =
    band === 'healthy'
      ? `Queue depth ${depth} — inside the healthy band (≤ ${QUEUE_HEALTHY_MAX}).`
      : band === 'watch'
        ? `Queue depth ${depth} — over the healthy ${QUEUE_HEALTHY_MAX}, under the ${QUEUE_OVER_CAPACITY} capacity line.`
        : `Queue depth ${depth} — above ${QUEUE_OVER_CAPACITY}.`

  const body =
    band === 'over_capacity'
      ? `If it stays here two weeks running, the constraint is triage capacity, not the thresholds. §4.1 allows tightening a threshold only when the queue is chronically over-depth and the tail rows are genuinely low-stakes — never to make this page look calm.`
      : band === 'watch'
        ? `Healthy is flat-or-shrinking week over week. Worth a look at what is entering the lists, not at the thresholds.`
        : `Both lists fit under the top-${QUEUE_TOP_N} cut.`

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${tone}`}>
      <span className="font-medium">{headline}</span>{' '}
      <span className="opacity-90">
        {burning} burning + {approaching} approaching. {body}
      </span>{' '}
      <span className="opacity-70">
        Week-over-week is not tracked yet — no daily snapshot of depth is stored, so the
        two-consecutive-weeks half of the policy is a manual read for now.
      </span>
    </div>
  )
}
