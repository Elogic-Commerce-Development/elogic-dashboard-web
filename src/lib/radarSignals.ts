import type { ProjectSignals } from '@/lib/queries'
import { formatHours } from '@/lib/format'

/**
 * The eight §4.1 Radar signals, rendered **in words**.
 *
 * §4.1: "active projects ranked by exposure, displayed as named firing
 * signals, never an opaque score". The exposure number decides the order and
 * stays off the screen; these sentences are what the reader acts on, and each
 * one carries the hours it contributed to that order — so the ranking is
 * always explainable by the rows beside it.
 *
 * Thresholds are NOT repeated here. Every sig_* boolean is decided in
 * `v_metric_config` on the database, per §4.1's retuning rule ("all thresholds
 * live in one SQL config view"). This module only puts language on a flag that
 * already fired, which is why the copy names the window (14 days, 4 weeks)
 * but never the trigger value.
 */
export type SignalTone = 'red' | 'amber'

export type FiringSignal = {
  key: string
  label: string
  /** The evidence, in words — counts and hours, no jargon. */
  detail: string
  /** Hours-at-risk this signal contributed to the project's exposure. */
  hours: number
  tone: SignalTone
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

/**
 * Signals for one project's signals row, ordered by the hours each contributed
 * — so the first sentence a reader sees is the one doing most of the ranking.
 * (Radar's queue rows extend `ProjectSignals`, and F6's project-detail banner
 * passes the bare signals row — same sentences on both pages by construction.)
 */
export function firingSignals(r: ProjectSignals): FiringSignal[] {
  const out: FiringSignal[] = []

  if (r.sig_live_overrun) {
    const recent = r.live_overrun_recent_tasks
    out.push({
      key: 'live_overrun',
      label: 'Live overrun',
      detail:
        `${r.live_overrun_tasks} open ${plural(r.live_overrun_tasks, 'task')} past estimate` +
        ` · ${formatHours(r.live_overrun_hours)} excess` +
        (recent > 0 ? ` · ${recent} still burning` : ' · none active in the last 14 days'),
      hours: r.live_overrun_hours,
      tone: 'red',
    })
  }

  if (r.sig_approaching) {
    out.push({
      key: 'approaching',
      label: 'Approaching estimate',
      detail:
        `${r.approaching_tasks} open ${plural(r.approaching_tasks, 'task')} at 80–100% consumed` +
        ` · ${formatHours(r.approaching_hours)} burned so far`,
      hours: r.approaching_hours,
      tone: 'amber',
    })
  }

  if (r.sig_second_qa_round) {
    out.push({
      key: 'second_qa_round',
      label: 'Second QA round',
      detail:
        `${r.second_qa_tasks} open ${plural(r.second_qa_tasks, 'task')} already returned twice or more` +
        ` · ${formatHours(r.second_qa_hours)} logged`,
      hours: r.second_qa_hours,
      tone: 'red',
    })
  }

  if (r.sig_stuck) {
    out.push({
      key: 'stuck',
      label: 'Stuck work',
      detail:
        `${r.stuck_tasks} estimated ${plural(r.stuck_tasks, 'task')} started then idle 14+ days` +
        ` · ${formatHours(r.stuck_hours)} already sunk` +
        ` against ${formatHours(r.stuck_estimate_hours)} estimated`,
      hours: r.stuck_hours,
      tone: 'amber',
    })
  }

  if (r.sig_spinning) {
    out.push({
      key: 'spinning',
      label: 'Spinning',
      detail:
        `${formatHours(r.hours_recent_4wk)} logged in 4 weeks with nothing completed` +
        (r.last_completion_on ? ` · last completion ${r.last_completion_on}` : ' · no completion on record'),
      hours: r.hours_recent_4wk,
      tone: 'red',
    })
  }

  if (r.sig_backlog_estimation_debt) {
    const runway = r.runway_weeks == null ? 'under 2 weeks' : `${r.runway_weeks.toFixed(1)} weeks`
    out.push({
      key: 'backlog_estimation_debt',
      label: 'Backlog is estimation debt',
      detail:
        `net +${r.backlog_net_growth_6wk} open ${plural(r.backlog_net_growth_6wk, 'task')} over 6 weeks` +
        ` · only ${formatHours(r.open_estimated_runway_hours)} of estimated work left (${runway} at the current burn)`,
      hours: r.open_estimated_runway_hours,
      tone: 'amber',
    })
  }

  if (r.sig_writeoff_drift) {
    const base =
      r.writeoff_baseline_pct == null
        ? 'no trailing baseline yet'
        : `baseline ${r.writeoff_baseline_pct.toFixed(1)}%`
    out.push({
      key: 'writeoff_drift',
      label: 'Write-off drift',
      detail:
        `${r.writeoff_pct == null ? '—' : `${r.writeoff_pct.toFixed(1)}%`} of hours non-billable` +
        ` (${base}) · ${formatHours(r.non_billable_hours)} eaten`,
      hours: r.non_billable_hours,
      tone: 'amber',
    })
  }

  if (r.sig_coverage_decay) {
    out.push({
      key: 'coverage_decay',
      label: 'Coverage decay',
      detail:
        `new tasks estimated ${r.recent_adoption_pct?.toFixed(1) ?? '—'}% in the last 90 days,` +
        ` down from ${r.prior_adoption_pct?.toFixed(1) ?? '—'}%` +
        ` · ${formatHours(r.recent_unestimated_hours)} unpriced since`,
      hours: r.recent_unestimated_hours,
      tone: 'amber',
    })
  }

  return out.sort((a, b) => b.hours - a.hours || a.key.localeCompare(b.key))
}

/** §5's work-model tag, in the words the pages use. */
export const WORK_MODEL_LABEL: Record<string, string> = {
  fixed_scope: 'Fixed scope',
  maintenance: 'Maintenance',
  tm_outstaff: 'T&M / outstaff',
  internal: 'Internal',
  unclassified: 'Untagged',
}
