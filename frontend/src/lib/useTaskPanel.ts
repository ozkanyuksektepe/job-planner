import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** The open task detail panel lives in the URL (?task=ID) so it works on every page. */
export function useTaskPanel() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('task')
  const taskId = raw ? Number(raw) || null : null

  const open = useCallback(
    (id: number) =>
      setParams((p) => {
        p.set('task', String(id))
        return p
      }),
    [setParams],
  )
  const close = useCallback(
    () =>
      setParams((p) => {
        p.delete('task')
        return p
      }),
    [setParams],
  )
  return { taskId, open, close }
}
