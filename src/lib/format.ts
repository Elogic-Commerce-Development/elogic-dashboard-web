export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)}h`
}

export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const pct = Math.round(Number(value) * 100)
  return `${pct}%`
}

export function formatQa(value: number | null | undefined, capped: boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return capped ? `${value}+` : String(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

const AC_ORG_ID = 162650

export function acTaskUrl(projectId: number, taskId: number): string {
  return `https://next-app.activecollab.com/${AC_ORG_ID}/projects/${projectId}/tasks/${taskId}`
}

export function acProjectUrl(projectId: number): string {
  return `https://next-app.activecollab.com/${AC_ORG_ID}/projects/${projectId}`
}

// Jira Cloud (PSP second source). Rows carry `source` + jira keys from the views.
const JIRA_BASE_URL = 'https://psppharma.atlassian.net'

export function jiraIssueUrl(issueKey: string): string {
  return `${JIRA_BASE_URL}/browse/${issueKey}`
}

export function jiraProjectUrl(projectKey: string): string {
  return `${JIRA_BASE_URL}/jira/software/projects/${projectKey}/boards`
}

/**
 * Source-aware external link for a task row: Jira rows open the Jira issue,
 * everything else (source null/'activecollab') opens ActiveCollab.
 */
export function externalTaskLink(opts: {
  source?: string | null
  projectId: number
  taskId: number
  taskJiraKey?: string | null
}): { url: string; label: string } {
  if (opts.source === 'jira' && opts.taskJiraKey) {
    return { url: jiraIssueUrl(opts.taskJiraKey), label: 'Open in Jira' }
  }
  return { url: acTaskUrl(opts.projectId, opts.taskId), label: 'Open in ActiveCollab' }
}

export function externalProjectLink(opts: {
  source?: string | null
  projectId: number
  projectJiraKey?: string | null
}): { url: string; label: string } {
  if (opts.source === 'jira' && opts.projectJiraKey) {
    return { url: jiraProjectUrl(opts.projectJiraKey), label: 'Open in Jira' }
  }
  return { url: acProjectUrl(opts.projectId), label: 'Open in ActiveCollab' }
}

// PeopleForce employee profile (Elogic tenant subdomain).
const PF_BASE_URL = 'https://elogic.peopleforce.io'

export function peopleForceEmployeeUrl(employeeId: number): string {
  return `${PF_BASE_URL}/employees/${employeeId}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
