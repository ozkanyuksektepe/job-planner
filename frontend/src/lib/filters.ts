import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Task, TaskInput } from './api'

export type FilterKey = 'project' | 'priority' | 'status' | 'tag'
export type TaskFilters = Record<FilterKey, string[]>

export const FILTER_KEYS: FilterKey[] = ['project', 'priority', 'status', 'tag']

/** Value used for "no project" in the project filter. */
export const NO_PROJECT = 'none'

function matches(t: Task, f: TaskFilters): boolean {
  if (f.project.length && !f.project.includes(t.project_id === null ? NO_PROJECT : String(t.project_id))) return false
  if (f.priority.length && !f.priority.includes(String(t.priority))) return false
  if (f.status.length && !f.status.includes(t.status)) return false
  if (f.tag.length && !t.tags.some((g) => f.tag.includes(String(g.id)))) return false
  return true
}

/**
 * Task filters kept in the URL (?project=1,none&priority=3&status=todo&tag=2) so they survive
 * reloads and opening the task panel. Within one filter values are OR-ed; different filters are AND-ed.
 * `hidden` filters are ignored on pages where they make no sense (e.g. project on a project page).
 */
export function useTaskFilters(hidden: FilterKey[] = []) {
  const [params, setParams] = useSearchParams()
  const hiddenKey = hidden.join(',')

  const filters = useMemo<TaskFilters>(() => {
    const skip = new Set(hiddenKey.split(','))
    const read = (k: FilterKey) => (skip.has(k) ? [] : (params.get(k)?.split(',').filter(Boolean) ?? []))
    return { project: read('project'), priority: read('priority'), status: read('status'), tag: read('tag') }
  }, [params, hiddenKey])

  const toggle = useCallback(
    (key: FilterKey, value: string) =>
      setParams(
        (p) => {
          const values = new Set(p.get(key)?.split(',').filter(Boolean))
          if (values.has(value)) values.delete(value)
          else values.add(value)
          if (values.size) p.set(key, [...values].join(','))
          else p.delete(key)
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const clear = useCallback(
    () =>
      setParams(
        (p) => {
          FILTER_KEYS.forEach((k) => p.delete(k))
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const active = FILTER_KEYS.reduce((n, k) => n + filters[k].length, 0)

  // Stable while the filters don't change, so pages can use it inside useMemo.
  const apply = useCallback(
    (tasks: Task[]) => (active === 0 ? tasks : tasks.filter((t) => matches(t, filters))),
    [filters, active],
  )

  // New tasks added while filtering should match the filter instead of vanishing right away.
  const defaults = useMemo<Omit<TaskInput, 'title'>>(() => {
    const d: Omit<TaskInput, 'title'> = {}
    if (filters.project.length === 1) d.project_id = filters.project[0] === NO_PROJECT ? null : Number(filters.project[0])
    if (filters.priority.length === 1) d.priority = Number(filters.priority[0])
    if (filters.tag.length > 0) d.tag_ids = filters.tag.map(Number)
    return d
  }, [filters])

  return { filters, toggle, clear, active, apply, hidden, defaults }
}

export type TaskFilterState = ReturnType<typeof useTaskFilters>
