import type { JSONContent } from '@tiptap/react'
import { Mic, Pin, StickyNote } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Note } from '../lib/api'
import { formatTimestamp } from '../lib/dates'
import { Chip, ColorDot, EmptyState } from './ui'

/** Plain-text preview of a TipTap JSON document. */
export function noteSnippet(content: string, max = 180): string {
  if (!content) return ''
  let doc: JSONContent
  try {
    doc = JSON.parse(content)
  } catch {
    return ''
  }
  const parts: string[] = []
  const walk = (n: JSONContent) => {
    if (n.text) parts.push(n.text)
    n.content?.forEach(walk)
    if (n.type && n.type !== 'text' && n.type !== 'doc') parts.push(' ')
  }
  walk(doc)
  const text = parts.join('').replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

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
      {notes.map((n) => {
        const snippet = noteSnippet(n.content)
        return (
          <Link
            key={n.id}
            to={`/notes/${n.id}`}
            className="group relative flex min-h-36 flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-fg-faint/40 hover:shadow-lg hover:shadow-black/5"
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
            <p className="mt-1.5 line-clamp-3 flex-1 text-[13px] leading-relaxed text-fg-muted">
              {snippet || <span className="italic text-fg-faint">Boş not</span>}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-1.5">
                {showProject && n.project_name && (
                  <Chip icon={<ColorDot color={n.project_color} className="size-1.5" />}>{n.project_name}</Chip>
                )}
                {n.audio_count > 0 && <Chip icon={<Mic className="size-3" />}>{n.audio_count}</Chip>}
              </span>
              <span className="text-[11px] text-fg-faint">{formatTimestamp(n.updated_at)}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
