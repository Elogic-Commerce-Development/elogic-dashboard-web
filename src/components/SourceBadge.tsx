/**
 * Small "Jira" pill shown next to a task/project name when the row originates
 * from Jira. ActiveCollab rows render nothing — it's the implicit default, so
 * badging every AC row would just add noise.
 */
export function SourceBadge({ source }: { source?: string | null }) {
  if (source !== 'jira') return null
  return (
    <span
      className="shrink-0 rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-indigo-700"
      title="Tracked in Jira (PSP)"
    >
      Jira
    </span>
  )
}
