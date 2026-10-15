import { Check, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { Project } from '../lib/api'
import { useCreateProject, useUpdateProject } from '../lib/hooks'
import { Button, ErrorBox, PROJECT_COLORS } from './ui'

const fieldCls =
  'w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-fg-faint focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10'

/** Create a project, or edit one when `project` is given. */
export default function ProjectDialog({ project, onClose, onSaved }: {
  project?: Project
  onClose: () => void
  onSaved?: (p: Project) => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0])
  const create = useCreateProject()
  const update = useUpdateProject()
  const mutation = project ? update : create

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const input = { name: name.trim(), description, color }
    const saved = project ? await update.mutateAsync({ id: project.id, patch: input }) : await create.mutateAsync(input)
    onSaved?.(saved)
    if (!onSaved) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-zinc-950/20 px-4 pt-[14vh] backdrop-blur-sm dark:bg-black/50"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/20"
      >
        <div className="h-1 w-full transition-colors" style={{ backgroundColor: color }} />
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{project ? 'Projeyi düzenle' : 'Yeni proje'}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2">
              <X className="size-4" />
            </Button>
          </div>

          <label className="mb-1.5 block text-xs font-medium text-fg-muted">Ad</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="örn. Kişisel web sitesi"
            className={`${fieldCls} mb-4`}
          />

          <label className="mb-1.5 block text-xs font-medium text-fg-muted">Açıklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Projenin amacı, kapsamı…"
            className={`${fieldCls} mb-4 resize-none`}
          />

          <label className="mb-2 block text-xs font-medium text-fg-muted">Renk</label>
          <div className="mb-6 flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`flex size-7 items-center justify-center rounded-full text-white transition-transform hover:scale-110 ${
                  color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface' : ''
                }`}
                style={{ backgroundColor: c, ['--tw-ring-color' as string]: c }}
                aria-label={c}
              >
                {color === c && <Check className="size-3.5" strokeWidth={3} />}
              </button>
            ))}
          </div>

          {mutation.error && <div className="mb-4"><ErrorBox error={mutation.error} /></div>}

          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Vazgeç</Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || mutation.isPending}>
              {project ? 'Kaydet' : 'Oluştur'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
