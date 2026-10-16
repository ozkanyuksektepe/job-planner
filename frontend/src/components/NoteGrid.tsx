import { Mic, Pin, StickyNote } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Note } from '../lib/api'
import { formatTimestamp } from '../lib/dates'
import { Chip, ColorDot, EmptyState } from './ui'

export default function NoteGrid({ notes, showProject = true }: { notes: Note[]; showProject?: boolean }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<StickyNote className="size-6" />}
        title="Henüz not yok"
        hint="Fikirlerini, toplantı notlarını ve planlarını burada topla."
      />
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {notes.map((n) => (
        <Link
          key={n.id}
          to={`/notes/${n.id}`}
          className="group relative flex min-h-24 flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-fg-faint/40 hover:shadow-lg hover:shadow-black/5"
        >
          <div
            className="absolute inset-x-0 top-0 h-0.5 opacity-70 transition-opacity group-hover:opacity-100"
            style={{ backgroundColor: n.project_color ?? 'var(--line)' }}
          />
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-semibold leading-snug tracking-tight ${n.title ? 'text-fg' : 'text-fg-faint'}`}>
              {n.title || 'Başlıksız not'}
            </h3>
            {n.pinned && <Pin className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5">
              {showProject && n.project_name && (
                <Chip icon={<ColorDot color={n.project_color} className="size-1.5" />}>{n.project_name}</Chip>
              )}
              {n.audio_count > 0 && <Chip icon={<Mic className="size-3" />}>{n.audio_count}</Chip>}
            </span>
            <span className="text-[11px] text-fg-faint">{formatTimestamp(n.updated_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
