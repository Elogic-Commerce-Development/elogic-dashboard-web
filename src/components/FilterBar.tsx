import { useEffect, useMemo, useState } from 'react'
import { fetchProjects, fetchUsers, type ProjectListItem, type UserListItem } from '@/lib/queries'
import type { Filters } from '@/lib/filters'

type Props = {
  value: Filters
  onChange: (next: Filters) => void
  hideDateRange?: boolean
}

function SearchableMultiSelect<T extends { id: number }>({
  label,
  summaryLabel,
  items,
  selectedIds,
  onChange,
  displayName,
  searchPlaceholder,
}: {
  label: string
  summaryLabel: string
  items: T[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  displayName: (item: T) => string
  searchPlaceholder: string
}) {
  const [search, setSearch] = useState('')
  const lowerSearch = search.toLowerCase()
  const filtered = search
    ? items.filter((item) => displayName(item).toLowerCase().includes(lowerSearch))
    : items

  function toggle(id: number) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((v) => v !== id)
        : [...selectedIds, id]
    )
  }

  return (
    <div className="min-w-[220px]">
      <label className="mb-1 block text-xs font-medium text-neutral-600">
        {label} <span className="font-normal text-neutral-400">({summaryLabel})</span>
      </label>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
        className="mb-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm placeholder:text-neutral-400"
      />
      <div className="h-24 w-full overflow-y-auto rounded-md border border-neutral-300">
        {filtered.length === 0 ? (
          <div className="px-2 py-2 text-xs text-neutral-400">No matches</div>
        ) : (
          filtered.map((item) => {
            const selected = selectedIds.includes(item.id)
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center gap-1.5 px-2 py-0.5 text-sm hover:bg-neutral-100 ${
                  selected ? 'bg-blue-50 font-medium text-blue-900' : 'text-neutral-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(item.id)}
                  className="accent-blue-600"
                />
                <span className="truncate">{displayName(item)}</span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
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

      <SearchableMultiSelect
        label="Projects"
        summaryLabel={projectLabel}
        items={projects}
        selectedIds={value.projectIds}
        onChange={(projectIds) => onChange({ ...value, projectIds })}
        displayName={(p) => p.name}
        searchPlaceholder="Search projects…"
      />

      <SearchableMultiSelect
        label="Users"
        summaryLabel={userLabel}
        items={users}
        selectedIds={value.userIds}
        onChange={(userIds) => onChange({ ...value, userIds })}
        displayName={(u) => u.display_name}
        searchPlaceholder="Search users…"
      />

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
