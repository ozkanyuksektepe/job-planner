import { CornerDownLeft, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { TaskInput } from '../lib/api'
import { useCreateTask } from '../lib/hooks'

/** One-line task input; `defaults` decide where the new task lands (project, day, parent). */
export default function QuickAdd({ defaults, placeholder = 'Görev ekle…', compact = false }: {
  defaults?: Omit<TaskInput, 'title'>
  placeholder?: string
  compact?: boolean
}) {
  const [title, setTitle] = useState('')
  const create = useCreateTask()

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    create.mutate({ ...defaults, title: t })
    setTitle('')
  }

  if (compact) {
    return (
      <form onSubmit={submit} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <Plus className="size-4 shrink-0 text-fg-faint" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-faint"
        />
      </form>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="group mb-8 flex h-12 items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 shadow-xs transition-all focus-within:border-accent/50 focus-within:bg-surface focus-within:ring-4 focus-within:ring-accent/10"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-fg transition-colors group-focus-within:bg-accent group-focus-within:text-white">
        <Plus className="size-3.5" strokeWidth={2.5} />
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
    </form>
  )
}
