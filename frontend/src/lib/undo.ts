import { useSyncExternalStore } from 'react'
import { queryClient } from './queryClient'

/**
 * Deletes with "Geri al": the item disappears at once (queries hide it via usePendingDeletes),
 * a toast offers undo, and the DELETE request is only sent when the toast runs out.
 * Undo therefore just forgets the request; nothing has to be restored on the server.
 */

export type DeleteKind = 'task' | 'note' | 'column' | 'board' | 'tag' | 'attachment'

export const UNDO_DELAY = 6000

interface PendingDelete {
  key: number
  kind: DeleteKind
  id: number
  /** API path for the DELETE request, e.g. /tasks/12 */
  endpoint: string
  message: string
  timer: number
  /** the request was sent; the item stays hidden until fresh data arrives */
  committing: boolean
}

export interface Toast {
  key: number
  message: string
  tone: 'undo' | 'error'
}

export type PendingSets = Record<DeleteKind, ReadonlySet<number>>

let nextKey = 1
let pending: PendingDelete[] = []
let errors: Toast[] = []
let hidden = buildSets()
let toasts: Toast[] = []
const listeners = new Set<() => void>()

function buildSets(): PendingSets {
  const sets: Record<DeleteKind, Set<number>> = {
    task: new Set(), note: new Set(), column: new Set(), board: new Set(), tag: new Set(), attachment: new Set(),
  }
  pending.forEach((p) => sets[p.kind].add(p.id))
  return sets
}

function emit() {
  hidden = buildSets()
  toasts = [
    ...pending.filter((p) => !p.committing).map((p): Toast => ({ key: p.key, message: p.message, tone: 'undo' })),
    ...errors,
  ]
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Hides the item now and deletes it on the server after UNDO_DELAY unless undone. */
export function deleteWithUndo(item: { kind: DeleteKind; id: number; endpoint: string; message: string }) {
  if (pending.some((p) => p.kind === item.kind && p.id === item.id)) return
  const key = nextKey++
  const timer = window.setTimeout(() => commit(key), UNDO_DELAY)
  pending = [...pending, { ...item, key, timer, committing: false }]
  emit()
}

export function undo(key: number) {
  const p = pending.find((x) => x.key === key && !x.committing)
  if (!p) return
  window.clearTimeout(p.timer)
  pending = pending.filter((x) => x !== p)
  emit()
}

/** Undoes the most recent delete that can still be undone; false when there is none. */
export function undoLast(): boolean {
  const last = [...pending].reverse().find((p) => !p.committing)
  if (!last) return false
  undo(last.key)
  return true
}

export function dismissError(key: number) {
  errors = errors.filter((e) => e.key !== key)
  emit()
}

async function commit(key: number) {
  const p = pending.find((x) => x.key === key)
  if (!p || p.committing) return
  p.committing = true
  emit()
  let ok = false
  try {
    const res = await fetch('/api' + p.endpoint, { method: 'DELETE' })
    // Already gone (e.g. deleted together with its parent) counts as done.
    ok = res.ok || res.status === 404
  } catch {
    ok = false
  }
  // Keep it hidden until fresh data without it has arrived, so it doesn't flash back.
  if (ok) await refreshAfterDelete(p)
  pending = pending.filter((x) => x.key !== key)
  if (!ok) {
    const errorKey = nextKey++
    errors = [...errors, { key: errorKey, message: 'Silinemedi, tekrar dene', tone: 'error' }]
    window.setTimeout(() => dismissError(errorKey), 4000)
  }
  emit()
}

function refreshAfterDelete(p: PendingDelete) {
  if (p.kind === 'note') queryClient.removeQueries({ queryKey: ['notes', 'one', p.id] })
  // A delete can change counts and lists almost anywhere; it's a local app, so refresh all.
  // An open note is left alone: its editor owns the content while typing.
  return queryClient.invalidateQueries({ predicate: (q) => !(q.queryKey[0] === 'notes' && q.queryKey[1] === 'one') })
}

// Leaving the page doesn't cancel a delete the user didn't undo.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    pending
      .filter((p) => !p.committing)
      .forEach((p) => {
        window.clearTimeout(p.timer)
        void fetch('/api' + p.endpoint, { method: 'DELETE', keepalive: true })
      })
  })
}

/** Ids of items waiting to be deleted, per kind; queries filter them out. */
export function usePendingDeletes(): PendingSets {
  return useSyncExternalStore(subscribe, () => hidden)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts)
}
