import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Task, TaskInput } from '../lib/api'
import { useTaskPanel } from '../lib/useTaskPanel'
import QuickAdd from './QuickAdd'
import { PriorityBadge, TaskCheckbox, taskMetaChips } from './TaskItem'
import { CountPill } from './ui'

export interface BoardColumn {
  id: string
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  tasks: Task[]
  /** emphasised column, e.g. today in the week view */
  highlight?: boolean
  /** stays visible on the left while the board scrolls horizontally */
  pinned?: boolean
  /** where tasks added from this column's input land; omit to hide the input */
  quickAdd?: Omit<TaskInput, 'title'>
  /** runs after a task is added from this column's input */
  onCreated?: (task: Task) => void
  /** extra buttons in the column header (shown on hover) */
  actions?: ReactNode
}

export interface BoardMove {
  task: Task
  columnId: string
  /** neighbours at the drop position, used to compute the new sort order */
  before: Task | null
  after: Task | null
  changedColumn: boolean
}

/** Sort order that places a task between two neighbours. */
export function sortOrderBetween(before: Task | null, after: Task | null, fallback: number): number {
  if (before && after) return (before.sort_order + after.sort_order) / 2
  if (before) return before.sort_order + 1
  if (after) return after.sort_order - 1
  return fallback
}

type Items = Record<string, number[]>

/**
 * Columns of task cards with drag and drop between and within columns.
 * `columns` must be memoized by the caller: a new array resets the local order to it.
 */
export default function Board({ columns, onMove, columnClassName = 'w-72', ...display }: {
  columns: BoardColumn[]
  onMove: (move: BoardMove) => void
  columnClassName?: string
} & CardDisplay) {
  const taskById = useMemo(() => new Map(columns.flatMap((c) => c.tasks.map((t) => [t.id, t] as const))), [columns])
  const serverItems = useMemo<Items>(() => Object.fromEntries(columns.map((c) => [c.id, c.tasks.map((t) => t.id)])), [columns])

  // Local order while dragging and until fresh data arrives from the server.
  const [items, setItems] = useState<Items>(serverItems)
  const [activeId, setActiveId] = useState<number | null>(null)
  const origin = useRef<string | null>(null)
  const dragging = useRef(false)

  useEffect(() => {
    if (!dragging.current) setItems(serverItems)
  }, [serverItems])

  const sensors = useSensors(
    // A small distance keeps plain clicks (open task) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function findColumn(id: UniqueIdentifier): string | undefined {
    if (typeof id === 'string' && id in items) return id
    return Object.keys(items).find((key) => items[key].includes(id as number))
  }

  function onDragStart({ active }: DragStartEvent) {
    dragging.current = true
    setActiveId(active.id as number)
    origin.current = findColumn(active.id) ?? null
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const from = findColumn(active.id)
    const to = findColumn(over.id)
    if (!from || !to || from === to) return

    setItems((prev) => {
      const toItems = [...prev[to]]
      const overIndex = typeof over.id === 'string' ? -1 : toItems.indexOf(over.id as number)
      const translated = active.rect.current.translated
      const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2
      const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : toItems.length
      toItems.splice(index, 0, active.id as number)
      return { ...prev, [from]: prev[from].filter((id) => id !== active.id), [to]: toItems }
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    dragging.current = false
    setActiveId(null)
    const id = active.id as number
    const column = findColumn(active.id)
    if (!over || !column) {
      setItems(serverItems)
      return
    }

    let next = items
    if (typeof over.id === 'number' && findColumn(over.id) === column) {
      const oldIndex = items[column].indexOf(id)
      const newIndex = items[column].indexOf(over.id)
      if (oldIndex !== newIndex) {
        next = { ...items, [column]: arrayMove(items[column], oldIndex, newIndex) }
        setItems(next)
      }
    }

    const list = next[column]
    const index = list.indexOf(id)
    const changedColumn = column !== origin.current
    if (!changedColumn && serverItems[column]?.indexOf(id) === index) return

    const task = taskById.get(id)
    if (!task) return
    onMove({
      task,
      columnId: column,
      before: index > 0 ? taskById.get(list[index - 1]) ?? null : null,
      after: index < list.length - 1 ? taskById.get(list[index + 1]) ?? null : null,
      changedColumn,
    })
  }

  function onDragCancel() {
    dragging.current = false
    setActiveId(null)
    setItems(serverItems)
  }

  const activeTask = activeId !== null ? taskById.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div data-board-scroller className="-mx-10 overflow-x-auto px-10 pb-4">
        <div className="flex items-start gap-3">
          {columns.map((c) => (
            <Column
              key={c.id}
              column={c}
              ids={items[c.id] ?? []}
              taskById={taskById}
              className={columnClassName}
              display={display}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {activeTask && <TaskCard task={activeTask} overlay {...display} />}
      </DragOverlay>
    </DndContext>
  )
}

/** Which metadata chips cards show (e.g. no status chip on a status board). */
interface CardDisplay {
  showProject?: boolean
  showSchedule?: boolean
  showStatus?: boolean
}

function Column({ column, ids, taskById, className, display }: {
  column: BoardColumn
  ids: number[]
  taskById: Map<number, Task>
  className: string
  display: CardDisplay
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const tasks = ids.map((id) => taskById.get(id)).filter((t): t is Task => t !== undefined)
  const open = tasks.filter((t) => t.status !== 'done').length

  return (
    <div
      data-column={column.id}
      className={`group/col flex shrink-0 flex-col rounded-2xl border transition-colors ${className} ${
        column.highlight ? 'border-accent/40 bg-accent-soft/60' : 'border-line bg-surface-2'
      } ${column.pinned ? 'sticky left-0 z-10 shadow-[10px_0_20px_-14px_rgb(0_0_0/0.35)]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 px-3.5 pb-1 pt-3">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 text-[13px] font-semibold ${column.highlight ? 'text-accent-fg' : 'text-fg'}`}>
            {column.icon}
            <span className="truncate">{column.title}</span>
          </div>
          {column.subtitle && <div className="mt-0.5 text-[11px] text-fg-faint">{column.subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {column.actions && (
            <div className="flex items-center opacity-0 transition-opacity group-hover/col:opacity-100">{column.actions}</div>
          )}
          <CountPill tone={column.highlight ? 'accent' : 'default'}>{open}</CountPill>
        </div>
      </div>

      <SortableContext id={column.id} items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`m-1.5 flex min-h-28 flex-1 flex-col gap-2 rounded-xl p-1 transition-colors ${isOver ? 'bg-accent/8' : ''}`}
        >
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} display={display} />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line py-6 text-[11px] text-fg-faint">
              Buraya sürükle
            </div>
          )}
        </div>
      </SortableContext>

      {column.quickAdd && (
        <div className="mx-1.5 mb-1.5 rounded-lg transition-colors focus-within:bg-surface hover:bg-hover">
          <QuickAdd compact defaults={column.quickAdd} onCreated={column.onCreated} placeholder="Ekle…" />
        </div>
      )}
    </div>
  )
}

function SortableCard({ task, display }: { task: Task; display: CardDisplay }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'opacity-35' : ''}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} {...display} />
    </div>
  )
}

export function TaskCard({ task, overlay = false, showProject = true, showSchedule = true, showStatus = true }: {
  task: Task
  overlay?: boolean
} & CardDisplay) {
  const { open, taskId } = useTaskPanel()
  const done = task.status === 'done'
  const selected = taskId === task.id
  const meta = taskMetaChips(task, { showProject, showSchedule, showStatus })
  const showFooter = meta.length > 0 || (!done && task.priority > 0)

  return (
    <div
      onClick={() => open(task.id)}
      className={`group cursor-grab rounded-xl border bg-surface px-3 py-2.5 shadow-xs transition-[border-color,box-shadow] active:cursor-grabbing ${
        selected ? 'border-accent/60 ring-2 ring-accent/15' : 'border-line hover:border-fg-faint/50 hover:shadow-sm'
      } ${overlay ? 'rotate-[1.5deg] cursor-grabbing shadow-xl shadow-black/15' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">
          <TaskCheckbox task={task} size="sm" />
        </div>
        <div className={`min-w-0 flex-1 text-[13px] leading-5 ${done ? 'text-fg-faint line-through' : 'text-fg'}`}>{task.title}</div>
      </div>
      {showFooter && (
        <div className="mt-2 flex flex-wrap items-center gap-1 pl-[26px]">
          {!done && <PriorityBadge priority={task.priority} />}
          {meta}
        </div>
      )}
    </div>
  )
}
