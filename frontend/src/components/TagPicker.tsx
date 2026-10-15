import { Check, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TagRef } from '../lib/api'
import { useCreateTag, useTags } from '../lib/hooks'
import { TagChip } from './TaskItem'
import { PROJECT_COLORS } from './ui'

/** Shows a task's tags with remove buttons and a popover to add existing or new tags. */
export default function TagPicker({ value, onChange }: { value: TagRef[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: tags = [] } = useTags()
  const create = useCreateTag()
  const ref = useRef<HTMLDivElement>(null)
  const selected = new Set(value.map((t) => t.id))

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const q = query.trim().replace(/^#/, '')
  const filtered = tags.filter((t) => t.name.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR')))
  const exact = tags.some((t) => t.name.toLocaleLowerCase('tr-TR') === q.toLocaleLowerCase('tr-TR'))

  function toggle(id: number) {
    const ids = new Set(selected)
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    onChange([...ids])
  }

  async function createAndAdd() {
    if (!q) return
    // Pick a color that cycles through the palette so new tags look distinct.
    const color = PROJECT_COLORS[tags.length % PROJECT_COLORS.length]
    const tag = await create.mutateAsync({ name: q, color })
    onChange([...selected, tag.id])
    setQuery('')
  }

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-1.5 py-1">
      {value.map((t) => (
        <TagChip key={t.id} tag={t}>
          <button
            type="button"
            onClick={() => toggle(t.id)}
            className="-mr-0.5 ml-0.5 rounded text-fg-faint hover:text-fg"
            title="Etiketi kaldır"
          >
            <X className="size-3" />
          </button>
        </TagChip>
      ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-line px-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:border-accent/50 hover:text-accent-fg"
      >
        <Plus className="size-3" /> Etiket
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 animate-pop overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-black/10">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const match = filtered[0]
                if (exact && match) toggle(match.id)
                else createAndAdd()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
              }
            }}
            placeholder="Etiket ara ya da oluştur…"
            className="w-full border-b border-line bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-fg-faint"
          />
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-hover"
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="flex-1 truncate">{t.name}</span>
                {selected.has(t.id) && <Check className="size-3.5 text-accent-fg" />}
              </button>
            ))}
            {q && !exact && (
              <button
                type="button"
                onClick={createAndAdd}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-accent-fg transition-colors hover:bg-accent-soft"
              >
                <Plus className="size-3.5" /> “{q}” etiketini oluştur
              </button>
            )}
            {!q && tags.length === 0 && <p className="px-2 py-2 text-xs text-fg-faint">Henüz etiket yok. Yazıp Enter'a bas.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
