import { EditorContent, useEditor } from '@tiptap/react'
import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import { useUpdateTask } from '../lib/hooks'
import { editorExtensions, editorProse, parseContent, Toolbar } from './NoteEditor'

const AUTOSAVE_DELAY = 700

/**
 * Rich text task description (TipTap JSON string; empty editor saves ''). Collapsed it shows the
 * first lines; clicking into it opens it fully with the toolbar. Saves while typing and when left.
 */
export default function DescriptionEditor({ taskId, content }: { taskId: number; content: string }) {
  const { mutate: updateTask } = useUpdateTask()
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (pending.current === null) return
    const description = pending.current
    pending.current = null
    updateTask({ id: taskId, patch: { description } })
  }, [taskId, updateTask])

  const editor = useEditor({
    extensions: editorExtensions('Detaylar, linkler, notlar… (- liste, [] yapılacak)'),
    content: parseContent(content),
    onUpdate: ({ editor }) => {
      pending.current = editor.isEmpty ? '' : JSON.stringify(editor.getJSON())
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, AUTOSAVE_DELAY)
    },
    onFocus: () => setExpanded(true),
    editorProps: { attributes: { class: `${editorProse} prose-sm min-h-16` } },
  })

  // Save what's left when the panel closes or switches to another task.
  useEffect(() => flush, [flush])

  // Whether the collapsed view cuts off text (then it fades out and offers "Tümünü göster").
  const measure = useCallback(() => {
    const el = boxRef.current
    setOverflowing(!!el && el.scrollHeight > el.clientHeight + 1)
  }, [])
  useLayoutEffect(measure, [measure, expanded])
  useEffect(() => {
    editor.on('update', measure)
    return () => {
      editor.off('update', measure)
    }
  }, [editor, measure])

  function onBlur(e: FocusEvent) {
    // Toolbar buttons keep focus in the editor; only leaving the whole box collapses it.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    flush()
    setExpanded(false)
  }

  function expand() {
    setExpanded(true)
    editor.commands.focus('end')
  }

  return (
    <div
      onBlur={onBlur}
      className={`mb-7 rounded-xl border transition-all ${
        expanded ? 'border-accent/50 bg-surface ring-4 ring-accent/10' : 'border-line bg-surface-2 hover:border-fg-faint/40'
      }`}
    >
      {expanded && (
        <div className="border-b border-line px-1.5 py-1">
          <Toolbar editor={editor} className="" />
        </div>
      )}
      <div
        ref={boxRef}
        className={`relative cursor-text px-3.5 py-3 ${expanded ? '' : 'max-h-44 overflow-hidden'}`}
        // Clicks on the text already focus the editor at that spot; this covers the padding around it.
        onClick={() => !editor.isFocused && expand()}
      >
        <EditorContent editor={editor} />
        {!expanded && overflowing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-xl bg-linear-to-t from-surface-2 to-transparent" />
        )}
      </div>
      {!expanded && overflowing && (
        <button
          type="button"
          onClick={expand}
          className="flex w-full items-center justify-center gap-1 border-t border-line py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ChevronDown className="size-3.5" /> Tümünü göster
        </button>
      )}
    </div>
  )
}
