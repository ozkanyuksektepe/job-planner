import { Check, Hash, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FilterBar from '../components/FilterBar'
import QuickAdd from '../components/QuickAdd'
import TaskList from '../components/TaskList'
import { Button, EmptyState, ErrorBox, Page, PageHeader, PROJECT_COLORS, Spinner } from '../components/ui'
import type { Tag } from '../lib/api'
import { useTaskFilters } from '../lib/filters'
import { useDeleteTag, useTag, useTasks, useUpdateTag } from '../lib/hooks'

export default function TagPage() {
  const id = Number(useParams().tagId)
  const { data: tag, isLoading, error } = useTag(id)
  const tasks = useTasks({ tag_id: id })
  const filter = useTaskFilters(['tag'])
  const visible = filter.apply(tasks.data ?? [])
  const remove = useDeleteTag()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  if (isLoading) return <Page><Spinner /></Page>
  if (error || !tag) return <Page><ErrorBox error={error ?? 'Etiket bulunamadı'} /></Page>

  async function deleteTag() {
    if (!confirm(`"${tag!.name}" etiketi silinsin mi? Görevler silinmez, sadece bu etiket kaldırılır.`)) return
    await remove.mutateAsync(id)
    navigate('/today')
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Etiket"
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
              <Hash className="size-4.5" strokeWidth={2.5} />
            </span>
            {tag.name}
          </span>
        }
        subtitle={`${tag.open_tasks} açık görev`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title="Düzenle">
              <Pencil className="size-4" />
            </Button>
            <Button variant="danger" size="icon" onClick={deleteTag} title="Sil">
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />
      <QuickAdd defaults={{ ...filter.defaults, tag_ids: [id] }} placeholder={`#${tag.name} etiketli görev ekle…`} />
      <FilterBar state={filter} shown={visible.length} total={tasks.data?.length} />

      {tasks.isLoading && <Spinner />}
      {tasks.error && <ErrorBox error={tasks.error} />}
      {tasks.data &&
        (tasks.data.length === 0 ? (
          <EmptyState icon={<Hash className="size-6" />} title="Bu etikette görev yok" />
        ) : (
          <TaskList tasks={visible} emptyText={filter.active ? 'Filtreye uyan açık görev yok' : 'Açık görev yok'} />
        ))}

      {editing && <TagDialog tag={tag} onClose={() => setEditing(false)} />}
    </Page>
  )
}

function TagDialog({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)
  const update = useUpdateTag()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await update.mutateAsync({ id: tag.id, patch: { name: name.trim(), color } })
    onClose()
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
          <h2 className="text-lg font-semibold tracking-tight">Etiketi düzenle</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2">
            <X className="size-4" />
          </Button>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-fg-muted">Ad</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10"
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

        {update.error && <div className="mb-4"><ErrorBox error={update.error} /></div>}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Vazgeç</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || update.isPending}>
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  )
}
