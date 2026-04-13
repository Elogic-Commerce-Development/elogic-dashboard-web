import { useEffect, useMemo, useState } from 'react'
import { fetchProjects, fetchUsers, type ProjectListItem, type UserListItem } from '@/lib/queries'
import type { Filters } from '@/lib/filters'

type Props = {
  value: Filters
  onChange: (next: Filters) => void
  hideDateRange?: boolean
}

export function FilterBar({ value, onChange, hideDateRange }: Props) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])

  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => setProjects([]))
    fetchUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  const projectLabel = useMemo(() => {
    if (value.projectIds.length === 0) return 'All projects'
    if (value.projectIds.length === 1) {
      const name = projects.find((p) => p.id === value.projectIds[0])?.name
      return name ?? '1 project'
    }
    return `${value.projectIds.length} projects`
  }, [projects, value.projectIds])

  const userLabel = useMemo(() => {
    if (value.userIds.length === 0) return 'All users'
    if (value.userIds.length === 1) {
      const name = users.find((u) => u.id === value.userIds[0])?.display_name
      return name ?? '1 user'
    }
    return `${value.userIds.length} users`
  }, [users, value.userIds])

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      {!hideDateRange && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">From</label>
            <input
              type="date"
              value={value.from ?? ''}
              onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">To</label>
            <input
              type="date"
              value={value.to ?? ''}
              onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
        </>
      )}

      <div className="min-w-[220px]">
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Projects <span className="font-normal text-neutral-400">({projectLabel})</span>
        </label>
        <select
          multiple
          value={value.projectIds.map(String)}
          onChange={(e) =>
            onChange({
              ...value,
              projectIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
            })
          }
          className="h-24 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[220px]">
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Users <span className="font-normal text-neutral-400">({userLabel})</span>
        </label>
        <select
          multiple
          value={value.userIds.map(String)}
          onChange={(e) =>
            onChange({
              ...value,
              userIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
            })
          }
          className="h-24 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => onChange({ from: undefined, to: undefined, projectIds: [], userIds: [] })}
        className="ml-auto self-end rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Clear
      </button>
    </div>
  )
}
