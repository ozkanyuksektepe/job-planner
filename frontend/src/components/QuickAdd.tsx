import { CornerDownLeft, Mic, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Task, TaskInput } from '../lib/api'
import { useCreateTask } from '../lib/hooks'

const DICTATION_HINT = 'Klavyendeki mikrofon (dikte) tuşuna bas ve konuş'

/**
 * Helps with macOS dictation, which web pages can neither start nor detect: the mic button
 * focuses the input and shows a hint to press the keyboard's dictation key.
 */
function useDictationHint() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hint, setHint] = useState(false)
  // True while dictation / an input method still shows provisional (underlined) text.
  const composing = useRef(false)

  // Hide the hint after a while if nothing happens.
  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(false), 8000)
    return () => window.clearTimeout(t)
  }, [hint])

  const show = () => {
    inputRef.current?.focus()
    setHint(true)
  }

  const inputProps = {
    ref: inputRef,
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: () => {
      composing.current = false
    },
    onBlur: () => setHint(false),
  }

  return { show, hint, hide: () => setHint(false), composing, inputProps }
}

function MicButton({ onClick, active, size }: { onClick: () => void; active: boolean; size: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      // Keep focus in the input so dictation types there.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title="Sesle yaz: klavyendeki mikrofon tuşunu kullan"
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors ${size === 'sm' ? 'size-6' : 'size-7'} ${
        active ? 'bg-accent-soft text-accent-fg' : 'text-fg-faint hover:bg-hover hover:text-fg'
      }`}
    >
      <Mic className={size === 'sm' ? 'size-3.5' : 'size-4'} />
    </button>
  )
}

/** One-line task input; `defaults` decide where the new task lands (project, day, parent). */
export default function QuickAdd({ defaults, placeholder = 'Görev ekle…', compact = false, onCreated }: {
  defaults?: Omit<TaskInput, 'title'>
  placeholder?: string
  compact?: boolean
  /** called with the new task, e.g. to place it on a board */
  onCreated?: (task: Task) => void
}) {
  const [title, setTitle] = useState('')
  const create = useCreateTask()
  const dictation = useDictationHint()

  function change(value: string) {
    setTitle(value)
    dictation.hide()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    // Enter while dictated text is still provisional only confirms it.
    if (dictation.composing.current) return
    const t = title.trim()
    if (!t) return
    create.mutate({ ...defaults, title: t }, { onSuccess: onCreated })
    setTitle('')
  }

  if (compact) {
    return (
      <form onSubmit={submit} className="px-2 py-1.5">
        <div className="flex items-center gap-2.5">
          <Plus className="size-4 shrink-0 text-fg-faint" />
          <input
            {...dictation.inputProps}
            value={title}
            onChange={(e) => change(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-faint"
          />
          <MicButton onClick={dictation.show} active={dictation.hint} size="sm" />
        </div>
        {dictation.hint && <p className="mt-1 animate-fade-in pl-[26px] text-[11px] text-accent-fg">{DICTATION_HINT}</p>}
      </form>
    )
  }

  return (
    <div className="mb-4">
      <form
        onSubmit={submit}
        className="group flex h-12 items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 shadow-xs transition-all focus-within:border-accent/50 focus-within:bg-surface focus-within:ring-4 focus-within:ring-accent/10"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-fg transition-colors group-focus-within:bg-accent group-focus-within:text-white">
          <Plus className="size-3.5" strokeWidth={2.5} />
        </span>
        <input
          {...dictation.inputProps}
          value={title}
          onChange={(e) => change(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-faint"
        />
        <kbd
          className={`flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] text-fg-faint transition-opacity ${
            title ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <CornerDownLeft className="size-3" /> Ekle
        </kbd>
        <MicButton onClick={dictation.show} active={dictation.hint} size="md" />
      </form>
      {dictation.hint && (
        <p className="mt-1.5 flex animate-fade-in items-center gap-1.5 pl-1 text-xs text-accent-fg">
          <Mic className="size-3.5" /> {DICTATION_HINT}
        </p>
      )}
    </div>
  )
}
