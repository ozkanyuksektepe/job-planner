import { ChevronLeft, ChevronRight, Download, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { Attachment, AttachmentOwner } from '../lib/api'
import { useAttachments, useDeleteAttachment, useUploadAttachments } from '../lib/hooks'
import { CountPill, ErrorBox } from './ui'
import { confirmDialog } from './ConfirmDialog'

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'

const imagesOf = (files: FileList | File[] | null | undefined) => Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))

/** Photo grid for a task: pick, drag & drop or paste (⌘V) images; click one to view it large. */
export default function TaskAttachments({ taskId }: { taskId: number }) {
  const owner: AttachmentOwner = { type: 'task', id: taskId }
  // Shares the cache with the task's recordings; this section only shows photos.
  const { data: all = [] } = useAttachments(owner)
  const attachments = all.filter((a) => a.kind === 'image')
  const upload = useUploadAttachments()
  const { mutate: uploadFiles } = upload
  const remove = useDeleteAttachment()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)

  const send = (files: File[]) => {
    if (files.length) uploadFiles({ owner: { type: 'task', id: taskId }, files })
  }

  // Pasting an image (e.g. a screenshot) anywhere while the task is open attaches it.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = imagesOf(e.clipboardData?.files)
      if (files.length === 0) return
      e.preventDefault()
      uploadFiles({ owner: { type: 'task', id: taskId }, files })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [taskId, uploadFiles])

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    send(imagesOf(e.dataTransfer.files))
  }

  return (
    <div className="mb-7">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Fotoğraflar</span>
        {attachments.length > 0 && <CountPill>{attachments.length}</CountPill>}
      </div>

      {attachments.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {attachments.map((a, i) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
              <button type="button" onClick={() => setViewing(i)} className="size-full" title={a.filename}>
                <img src={a.url} alt={a.filename} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </button>
              <button
                type="button"
                onClick={async () => (await confirmDialog({ title: 'Bu fotoğraf silinsin mi?', message: 'Bu işlem geri alınamaz.' })) && remove.mutate({ id: a.id, owner })}
                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-lg bg-black/55 text-white opacity-0 backdrop-blur transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                title="Fotoğrafı sil"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3.5 text-xs transition-colors ${
          dragOver ? 'border-accent bg-accent-soft text-accent-fg' : 'border-line text-fg-muted hover:border-accent/50 hover:bg-hover hover:text-fg'
        }`}
      >
        {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {upload.isPending ? 'Yükleniyor…' : 'Fotoğraf ekle: tıkla, sürükle-bırak ya da ⌘V ile yapıştır'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          send(imagesOf(e.target.files))
          e.target.value = ''
        }}
      />
      {upload.error && <div className="mt-2"><ErrorBox error={upload.error} /></div>}

      {viewing !== null && attachments[viewing] && (
        <Lightbox items={attachments} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

function Lightbox({ items, index, onIndex, onClose }: {
  items: Attachment[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  useEffect(() => {
    // Capture phase + stopPropagation so Escape closes only the viewer, not the task panel.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onIndex(index - 1)
      else if (e.key === 'ArrowRight' && hasNext) onIndex(index + 1)
      else return
      e.stopPropagation()
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [index, hasPrev, hasNext, onIndex, onClose])

  const navBtn = 'flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20'

  return (
    <div className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm text-white/80" onClick={(e) => e.stopPropagation()}>
        <span className="truncate">
          {item.filename}
          <span className="ml-2 text-white/40">
            {index + 1} / {items.length}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <a href={item.url} download={item.filename} className={navBtn} title="İndir">
            <Download className="size-4" />
          </a>
          <button type="button" onClick={onClose} className={navBtn} title="Kapat (Esc)">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-10">
        <img
          key={item.id}
          src={item.url}
          alt={item.filename}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full animate-pop rounded-lg object-contain shadow-2xl"
        />
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onIndex(index - 1)
            }}
            className={`${navBtn} absolute left-4`}
            title="Önceki (←)"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onIndex(index + 1)
            }}
            className={`${navBtn} absolute right-4`}
            title="Sonraki (→)"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}
