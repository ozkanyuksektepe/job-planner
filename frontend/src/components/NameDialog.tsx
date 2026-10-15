import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from './ui'

/** Small modal asking for a single name (boards, board columns…). */
export default function NameDialog({ title, label = 'Ad', initial = '', placeholder, submitLabel = 'Kaydet', onSubmit, onClose }: {
  title: string
  label?: string
  initial?: string
  placeholder?: string
  submitLabel?: string
  onSubmit: (name: string) => Promise<unknown> | void
  onClose: () => void
}) {
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSubmit(name.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-zinc-950/20 px-4 pt-[14vh] backdrop-blur-sm dark:bg-black/50"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-pop rounded-2xl border border-line bg-surface p-6 shadow-2xl shadow-black/20"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2">
            <X className="size-4" />
          </Button>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="mb-6 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-fg-faint focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10"
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Vazgeç</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
