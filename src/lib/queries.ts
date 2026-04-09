import { supabase } from './supabase'
import type { Filters } from './filters'

export type TaskWithoutEstimate = {
  id: number
  name: string
  project_id: number
  project_name: string
  assignee_id: number | null
  assignee_name: string | null
  created_on: string
  due_on: string | null
}

export type TaskActualVsEstimate = {
  task_id: number
  project_id: number
  project_name: string
  assignee_id: number | null
  assignee_name: string | null
  task_name: string
  estimate_hours: number | null
  actual_hours: number
  ratio: number | null
  is_completed: boolean
  completed_on: string | null
  created_on: string
}

export type EstimateAccuracyByUser = {
  assignee_id: number | null
  assignee_name: string | null
  estimated_tasks: number
  total_tasks: number
  mean_ratio: number | null
  median_ratio: number | null
}

export type EstimateAccuracyByProject = {
  project_id: number
  project_name: string
  estimated_tasks: number
  total_tasks: number
  mean_ratio: number | null
  median_ratio: number | null
}

export type SyncStatusRow = {
  last_successful_sync: string | null
  task_count: number
  time_record_count: number
}

export type ProjectListItem = { id: number; name: string }
export type UserListItem = { id: number; display_name: string }

export async function fetchTasksWithoutEstimates(filters: Filters): Promise<TaskWithoutEstimate[]> {
  let q = supabase
    .from('v_tasks_without_estimates')
    .select('*')
    .order('created_on', { ascending: false })
    .limit(500)

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
  if (filters.from) q = q.gte('created_on', filters.from)
  if (filters.to) q = q.lte('created_on', filters.to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskWithoutEstimate[]
}

export async function fetchTasksOverrun(filters: Filters): Promise<TaskActualVsEstimate[]> {
  let q = supabase
    .from('v_tasks_overrun')
    .select('*')
    .order('ratio', { ascending: false })
    .limit(500)

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
  if (filters.from) q = q.gte('created_on', filters.from)
  if (filters.to) q = q.lte('created_on', filters.to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchActualVsEstimate(filters: Filters): Promise<TaskActualVsEstimate[]> {
  let q = supabase
    .from('v_task_actual_vs_estimate')
    .select('*')
    .not('estimate_hours', 'is', null)
    .order('created_on', { ascending: false })
    .limit(500)

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)
  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)
  if (filters.from) q = q.gte('created_on', filters.from)
  if (filters.to) q = q.lte('created_on', filters.to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TaskActualVsEstimate[]
}

export async function fetchAccuracyByUser(filters: Filters): Promise<EstimateAccuracyByUser[]> {
  let q = supabase
    .from('v_estimate_accuracy_by_user')
    .select('*')
    .order('estimated_tasks', { ascending: false })

  if (filters.userIds.length > 0) q = q.in('assignee_id', filters.userIds)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as EstimateAccuracyByUser[]
}

export async function fetchAccuracyByProject(filters: Filters): Promise<EstimateAccuracyByProject[]> {
  let q = supabase
    .from('v_estimate_accuracy_by_project')
    .select('*')
    .order('estimated_tasks', { ascending: false })

  if (filters.projectIds.length > 0) q = q.in('project_id', filters.projectIds)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as EstimateAccuracyByProject[]
}

export async function fetchSyncStatus(): Promise<SyncStatusRow | null> {
  const { data, error } = await supabase.from('v_sync_status').select('*').maybeSingle()
  if (error) throw error
  return (data as SyncStatusRow | null) ?? null
}

export async function fetchProjects(): Promise<ProjectListItem[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('is_trashed', false)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProjectListItem[]
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('is_archived', false)
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserListItem[]
}
