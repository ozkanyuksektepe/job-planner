import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold, Code, Heading1, Heading2, Heading3, Italic, List, ListOrdered, ListTodo, Minus, Quote, Redo2, SquareCode,
  Strikethrough, Undo2, type LucideIcon,
} from 'lucide-react'

function parseContent(content: string): JSONContent | string {
  if (!content) return ''
  try {
    return JSON.parse(content)
  } catch {
    return content // fall back to treating it as HTML / plain text
  }
}

/** Rich text editor; content is a TipTap JSON string, `onChange` fires on every edit. */
export default function NoteEditor({ content, onChange }: { content: string; onChange: (json: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Yazmaya başla… (# başlık, - liste, [] yapılacak, > alıntı)' }),
    ],
    content: parseContent(content),
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
    editorProps: {
      attributes: {
        class:
          'tiptap prose prose-zinc dark:prose-invert max-w-none min-h-[50vh] focus:outline-none prose-headings:mb-2 prose-headings:tracking-tight prose-p:my-1.5 prose-p:leading-relaxed prose-a:text-accent-fg prose-code:rounded prose-code:bg-hover prose-code:px-1 prose-code:py-0.5 prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-pre:bg-surface-2 prose-pre:text-fg prose-blockquote:border-accent/40 prose-blockquote:not-italic prose-blockquote:text-fg-muted',
      },
    },
  })

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render only when the selection's formatting changes.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const chain = () => editor.chain().focus()
  const groups: { icon: LucideIcon; title: string; active?: boolean; disabled?: boolean; run: () => void }[][] = [
    [
      { icon: Bold, title: 'Kalın (⌘B)', active: state.bold, run: () => chain().toggleBold().run() },
      { icon: Italic, title: 'İtalik (⌘I)', active: state.italic, run: () => chain().toggleItalic().run() },
      { icon: Strikethrough, title: 'Üstü çizili', active: state.strike, run: () => chain().toggleStrike().run() },
      { icon: Code, title: 'Satır içi kod', active: state.code, run: () => chain().toggleCode().run() },
    ],
    [
      { icon: Heading1, title: 'Başlık 1', active: state.h1, run: () => chain().toggleHeading({ level: 1 }).run() },
      { icon: Heading2, title: 'Başlık 2', active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { icon: Heading3, title: 'Başlık 3', active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { icon: List, title: 'Madde listesi', active: state.bullet, run: () => chain().toggleBulletList().run() },
      { icon: ListOrdered, title: 'Numaralı liste', active: state.ordered, run: () => chain().toggleOrderedList().run() },
      { icon: ListTodo, title: 'Yapılacaklar listesi', active: state.task, run: () => chain().toggleTaskList().run() },
      { icon: Quote, title: 'Alıntı', active: state.quote, run: () => chain().toggleBlockquote().run() },
      { icon: SquareCode, title: 'Kod bloğu', active: state.codeBlock, run: () => chain().toggleCodeBlock().run() },
      { icon: Minus, title: 'Ayraç', run: () => chain().setHorizontalRule().run() },
    ],
    [
      { icon: Undo2, title: 'Geri al (⌘Z)', disabled: !state.canUndo, run: () => chain().undo().run() },
      { icon: Redo2, title: 'Yinele (⇧⌘Z)', disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ]

  return (
    <div className="sticky top-3 z-10 mb-6 inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-surface/85 p-1 shadow-lg shadow-black/5 backdrop-blur-md">
      {groups.map((g, i) => (
        <div key={i} className="flex items-center gap-0.5 border-r border-line pr-0.5 last:border-r-0 last:pr-0">
          {g.map(({ icon: Icon, title, active, disabled, run }) => (
            <button
              key={title}
              type="button"
              title={title}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={run}
              className={`rounded-lg p-1.5 transition-colors disabled:opacity-30 ${
                active ? 'bg-accent-soft text-accent-fg' : 'text-fg-muted hover:bg-hover hover:text-fg'
              }`}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
