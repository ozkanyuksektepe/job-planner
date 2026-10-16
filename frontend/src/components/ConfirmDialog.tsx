import { CornerDownLeft, Trash2 } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

let pending: Pending | null = null
const listeners = new Set<() => void>()

function setPending(next: Pending | null) {
  pending = next
  listeners.forEach((l) => l())
}

/** Themed replacement for window.confirm; resolves true when the user confirms. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false)
  return new Promise((resolve) => setPending({ ...options, resolve }))
}

function answer(ok: boolean) {
  pending?.resolve(ok)
  setPending(null)
}

/** Renders the active confirmDialog(); mounted once in Layout. */
export function ConfirmHost() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pending,
  )

  useEffect(() => {
    if (!current) return
    // Capture phase + stopPropagation so Escape cancels only this dialog, not the task panel behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      answer(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [current])

  if (!current) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-zinc-950/25 p-4 backdrop-blur-sm dark:bg-black/60"
      onMouseDown={() => answer(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={current.message ? 'confirm-message' : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] animate-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/20"
      >
        <div className="px-6 pb-6 pt-7 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 ring-8 ring-rose-500/[0.05] dark:text-rose-400">
            <Trash2 className="size-6" />
          </div>
          <h2 id="confirm-title" className="mt-5 text-[17px] font-semibold leading-snug tracking-tight break-words text-fg">
            {current.title}
          </h2>
          {current.message && (
            <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-fg-muted">
              {current.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-line bg-surface-2 px-6 py-3.5">
          <button
            type="button"
            onClick={() => answer(false)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-fg shadow-xs outline-none transition-colors hover:bg-hover focus-visible:ring-4 focus-visible:ring-accent/15"
          >
            Vazgeç
            <kbd className="rounded-md border border-line px-1.5 py-px font-sans text-[10px] font-medium text-fg-faint">Esc</kbd>
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => answer(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-rose-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-rose-600/30 outline-none transition-colors hover:bg-rose-700 focus-visible:ring-4 focus-visible:ring-rose-500/25 dark:bg-rose-500 dark:hover:bg-rose-600"
          >
            {current.confirmLabel ?? 'Sil'}
            <kbd className="flex items-center rounded-md bg-white/20 px-1 py-0.5 font-sans">
              <CornerDownLeft className="size-3" />
            </kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
