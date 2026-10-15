import { ArrowLeft, Pin, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import NoteEditor from '../components/NoteEditor'
import { Button, ErrorBox, Spinner } from '../components/ui'
import type { Note, NotePatch } from '../lib/api'
import { formatTimestamp } from '../lib/dates'
import { useDeleteNote, useNote, useProjects, useUpdateNote } from '../lib/hooks'

const AUTOSAVE_DELAY = 700

export default function NotePage() {
  const id = Number(useParams().noteId)
  const { data: note, isLoading, error } = useNote(id)

  if (isLoading) return <Spinner />
  if (error || !note) return <ErrorBox error={error ?? 'Not bulunamadı'} />
  return <NoteView key={note.id} note={note} />
}

type SaveState = 'saved' | 'pending' | 'saving' | 'error'

/** Collects edits and saves them shortly after the user stops typing. */
function useAutosave(noteId: number) {
  const update = useUpdateNote()
  const pending = useRef<NotePatch>({})
  const timer = useRef<number | undefined>(undefined)
  const [state, setState] = useState<SaveState>('saved')

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const patch = pending.current
    if (Object.keys(patch).length === 0) return
    pending.current = {}
    setState('saving')
    update.mutate(
      { id: noteId, patch },
      {
        onSuccess: () => setState(Object.keys(pending.current).length ? 'pending' : 'saved'),
        onError: () => {
          pending.current = { ...patch, ...pending.current }
          setState('error')
        },
      },
    )
  }, [noteId, update])

  const queue = useCallback(
    (patch: NotePatch) => {
      Object.assign(pending.current, patch)
      setState('pending')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, AUTOSAVE_DELAY)
    },
    [flush],
  )

  // Save whatever is left when leaving the page or closing the tab.
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    const onUnload = () => flushRef.current()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      flushRef.current()
    }
  }, [])

  return { queue, flush, state }
}

const SAVE_LABELS: Record<SaveState, string> = {
  saved: 'Kaydedildi',
  pending: 'Düzenleniyor…',
  saving: 'Kaydediliyor…',
  error: 'Kaydedilemedi, tekrar denenecek',
}

function NoteView({ note }: { note: Note }) {
  const { queue, flush, state } = useAutosave(note.id)
  const update = useUpdateNote()
  const remove = useDeleteNote()
  const { data: projects = [] } = useProjects()
  const [title, setTitle] = useState(note.title)
  const navigate = useNavigate()
  const backTo = note.project_id ? `/projects/${note.project_id}/notes` : '/notes'

  async function deleteNote() {
    if (!confirm('Bu not silinsin mi? Bu işlem geri alınamaz.')) return
    await remove.mutateAsync(note.id)
    navigate(backTo)
  }

  return (
    <div>
      <div className="mb-10 flex items-center justify-between gap-3">
        <Link
          to={backTo}
          onClick={flush}
          className="-ml-2 flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          {note.project_name ?? 'Notlar'}
        </Link>
        <div className="flex items-center gap-1">
          <span className={`mr-2 flex items-center gap-1.5 text-xs ${state === 'error' ? 'text-rose-500' : 'text-fg-faint'}`}>
            <span
              className={`size-1.5 rounded-full ${
                state === 'saved' ? 'bg-emerald-500' : state === 'error' ? 'bg-rose-500' : 'animate-pulse bg-amber-500'
              }`}
            />
            {SAVE_LABELS[state]}
          </span>
          <select
            value={note.project_id ?? ''}
            onChange={(e) => update.mutate({ id: note.id, patch: { project_id: e.target.value ? Number(e.target.value) : null } })}
            className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-2 text-xs text-fg-muted outline-none transition-colors hover:bg-hover"
            title="Projeye taşı"
          >
            <option value="">Proje yok</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => update.mutate({ id: note.id, patch: { pinned: !note.pinned } })}
            title={note.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
          >
            <Pin className={`size-4 ${note.pinned ? 'fill-amber-400 text-amber-500' : ''}`} />
          </Button>
          <Button variant="danger" size="icon" onClick={deleteNote} title="Sil">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          queue({ title: e.target.value })
        }}
        placeholder="Başlıksız not"
        autoFocus={!note.title}
        className="mb-2 w-full bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:text-fg-faint/50"
      />
      <p className="mb-6 text-xs text-fg-faint">Son düzenleme {formatTimestamp(note.updated_at)}</p>

      <NoteEditor content={note.content} onChange={(content) => queue({ content })} />
    </div>
  )
}
