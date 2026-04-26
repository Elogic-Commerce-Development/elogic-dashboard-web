export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)}h`
}

export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const pct = Math.round(Number(value) * 100)
  return `${pct}%`
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

// PeopleForce employee profile. If your tenant uses a subdomain (e.g.
// elogic.peopleforce.io) instead of app.peopleforce.io, edit this constant.
const PF_BASE_URL = 'https://app.peopleforce.io'

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
