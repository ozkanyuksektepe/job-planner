import { Ban, Check, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, PROJECT_COLORS } from './ui'

/** Background of a coloured board area: a light tint of its colour that also works in dark mode. */
export const columnTint = (color: string) => `color-mix(in srgb, ${color} 13%, var(--surface-2))`
export const columnBorder = (color: string) => `color-mix(in srgb, ${color} 35%, var(--line))`

/** Create or edit a board area ("alan"): its name and an optional background colour. */
export default function ColumnDialog({ title, initialName = '', initialColor = null, submitLabel = 'Kaydet', onSubmit, onClose }: {
  title: string
  initialName?: string
  initialColor?: string | null
  submitLabel?: string
  onSubmit: (input: { name: string; color: string | null }) => Promise<unknown> | void
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState<string | null>(initialColor)
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
      await onSubmit({ name: name.trim(), color })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const swatch = 'flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110'

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-zinc-950/20 px-4 pt-[14vh] backdrop-blur-sm dark:bg-black/50"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/20"
      >
        <div className="h-1 w-full transition-colors" style={{ backgroundColor: color ?? 'var(--line)' }} />
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2">
              <X className="size-4" />
            </Button>
          </div>

          <label className="mb-1.5 block text-xs font-medium text-fg-muted">Ad</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="örn. Yapılacaklar, Önemli"
            className="mb-5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-fg-faint focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10"
          />

          <label className="mb-2 block text-xs font-medium text-fg-muted">Arka plan rengi</label>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              className={`${swatch} border border-line bg-surface-2 text-fg-faint ${
                color === null ? 'scale-110 ring-2 ring-fg-faint ring-offset-2 ring-offset-surface' : ''
              }`}
              title="Varsayılan"
              aria-label="Varsayılan renk"
            >
              {color === null ? <Check className="size-3.5" strokeWidth={3} /> : <Ban className="size-3.5" />}
            </button>
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`${swatch} text-white ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface' : ''}`}
                style={{ backgroundColor: c, ['--tw-ring-color' as string]: c }}
                aria-label={c}
              >
                {color === c && <Check className="size-3.5" strokeWidth={3} />}
              </button>
            ))}
          </div>

          {/* How the area will look on the board. */}
          <div
            className="mb-6 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[13px] font-semibold"
            style={color ? { backgroundColor: columnTint(color), borderColor: columnBorder(color) } : undefined}
          >
            <span className={color ? '' : 'text-fg-muted'}>{name.trim() || 'Alan önizlemesi'}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Vazgeç</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || saving}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
