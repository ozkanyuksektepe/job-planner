import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronRight, GripVertical } from 'lucide-react'
import { useState } from 'react'
import type { Task } from '../lib/api'
import { useUpdateTask } from '../lib/hooks'
import { sortOrderBetween } from './Board'
import TaskItem from './TaskItem'
import { CountPill } from './ui'

/** Shows open tasks, with completed ones folded away underneath. With `sortable`, open tasks can be dragged up and down. */
export default function TaskList({ tasks, showProject = true, emptyText, sortable = false }: {
  tasks: Task[]
  showProject?: boolean
  emptyText?: string
  sortable?: boolean
}) {
  const [showDone, setShowDone] = useState(false)
  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div>
      {sortable ? (
        <SortableTasks tasks={open} showProject={showProject} />
      ) : (
        <div className="flex flex-col gap-px">
          {open.map((t) => (
            <TaskItem key={t.id} task={t} showProject={showProject} />
          ))}
        </div>
      )}
      {open.length === 0 && emptyText && <p className="px-3 py-3 text-sm text-fg-muted">{emptyText}</p>}

      {done.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-fg-faint transition-colors hover:bg-hover hover:text-fg-muted"
          >
            <ChevronRight className={`size-3.5 transition-transform ${showDone ? 'rotate-90' : ''}`} />
            Tamamlananlar
            <CountPill>{done.length}</CountPill>
          </button>
          {showDone && (
            <div className="mt-1 flex animate-fade-in flex-col gap-px">
              {done.map((t) => (
                <TaskItem key={t.id} task={t} showProject={showProject} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SortableTasks({ tasks, showProject }: { tasks: Task[]; showProject: boolean }) {
  const { mutate: updateTask } = useUpdateTask()
  // Order after a drop, kept until the server's order (signature) changes.
  const signature = tasks.map((t) => `${t.id}:${t.sort_order}`).join(',')
  const [local, setLocal] = useState<{ signature: string; ids: number[] } | null>(null)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const ordered =
    local && local.signature === signature
      ? local.ids.map((id) => byId.get(id)).filter((t): t is Task => !!t)
      : tasks

  const sensors = useSensors(
    // A small distance keeps plain clicks (open task) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ordered.findIndex((t) => t.id === active.id)
    const to = ordered.findIndex((t) => t.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(ordered, from, to)
    const task = next[to]
    setLocal({ signature, ids: next.map((t) => t.id) })
    updateTask({ id: task.id, patch: { sort_order: sortOrderBetween(next[to - 1] ?? null, next[to + 1] ?? null, task.sort_order) } })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ordered.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-px">
          {ordered.map((t) => (
            <SortableRow key={t.id} task={t} showProject={showProject} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ task, showProject }: { task: Task; showProject: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      // Only move vertically; the list never changes columns.
      style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}
      className={`group/sort relative rounded-xl ${
        isDragging ? 'z-10 cursor-grabbing bg-surface shadow-lg shadow-black/10 ring-1 ring-line' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <GripVertical
        className={`pointer-events-none absolute -left-5 top-3 size-4 text-fg-faint transition-opacity ${
          isDragging ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-100'
        }`}
      />
      <TaskItem task={task} showProject={showProject} />
    </div>
  )
}
