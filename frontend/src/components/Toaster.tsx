import { CircleAlert, Trash2, Undo2, X } from 'lucide-react'
import { useEffect } from 'react'
import { dismissError, undo, undoLast, UNDO_DELAY, useToasts } from '../lib/undo'

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/** Bottom toasts for deletes that can still be undone (and failed deletes); mounted once in Layout. */
export default function Toaster() {
  const toasts = useToasts()

  // ⌘Z / Ctrl+Z undoes the last delete, unless the user is typing (then it's the field's own undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z' || isEditable(e.target)) return
      if (undoLast()) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.key}
          role="status"
          className="pointer-events-auto w-full max-w-sm animate-toast-in overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/20"
        >
          <div className="flex items-center gap-3 py-2.5 pl-3.5 pr-2">
            {t.tone === 'undo' ? (
              <Trash2 className="size-4 shrink-0 text-fg-faint" />
            ) : (
              <CircleAlert className="size-4 shrink-0 text-rose-500" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{t.message}</span>
            {t.tone === 'undo' ? (
              <button
                type="button"
                onClick={() => undo(t.key)}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-soft"
              >
                <Undo2 className="size-3.5" /> Geri al
                <kbd className="rounded border border-line px-1 font-sans text-[10px] font-medium text-fg-faint">⌘Z</kbd>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dismissError(t.key)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-faint transition-colors hover:bg-hover hover:text-fg"
                title="Kapat"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {t.tone === 'undo' && (
            // Time left to undo: the bar empties as the delete gets closer.
            <div className="mx-3.5 mb-2.5 h-1 overflow-hidden rounded-full bg-hover" aria-hidden>
              <div
                className="h-full origin-left rounded-full bg-accent"
                style={{ animation: `shrink-x ${UNDO_DELAY}ms linear forwards` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
