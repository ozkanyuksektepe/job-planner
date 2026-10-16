import {
  closestCenter, closestCorners, defaultDropAnimationSideEffects, DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  useDroppable, useSensor, useSensors, type CollisionDetection, type DropAnimation, type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  /** header counts every task in the column instead of only open ones (e.g. "Tamamlananlar") */
  countAll?: boolean
  /** extra buttons in the column header (shown on hover) */
  actions?: ReactNode
  /** the column can be dragged by its header to another place among the movable columns */
  movable?: boolean
}

export interface ColumnMove {
  columnId: string
  /** movable neighbours at the drop position */
  before: string | null
  after: string | null
}

// Sortable ids of draggable columns; cards use numeric task ids.
const COLUMN_PREFIX = 'column:'
const columnDragId = (id: string) => COLUMN_PREFIX + id
const isColumnDrag = (id: UniqueIdentifier) => typeof id === 'string' && id.startsWith(COLUMN_PREFIX)

/** A column drag only looks at columns, a card drag only at cards and column drop areas. */
const collisionDetection: CollisionDetection = (args) => {
  const columnDrag = isColumnDrag(args.active.id)
  const droppableContainers = args.droppableContainers.filter((c) => isColumnDrag(c.id) === columnDrag)
  return (columnDrag ? closestCenter : closestCorners)({ ...args, droppableContainers })
}

// dnd-kit hides the dragged element while the overlay animates into place. That suits cards, but a
// dragged column has no overlay, so hiding it would make it blink after the drop.
const hideCardWhileDropping = defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } })
const dropAnimation: DropAnimation = {
  duration: 180,
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  sideEffects: (params) => (isColumnDrag(params.active.id) ? undefined : hideCardWhileDropping(params)),
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
export default function Board({ columns, onMove, onMoveColumn, columnClassName = 'w-72', ...display }: {
  columns: BoardColumn[]
  onMove: (move: BoardMove) => void
  /** called after a movable column was dropped somewhere else */
  onMoveColumn?: (move: ColumnMove) => void
  columnClassName?: string
} & CardDisplay) {
  const taskById = useMemo(() => new Map(columns.flatMap((c) => c.tasks.map((t) => [t.id, t] as const))), [columns])
  const serverItems = useMemo<Items>(() => Object.fromEntries(columns.map((c) => [c.id, c.tasks.map((t) => t.id)])), [columns])

  // Local order while dragging and until fresh data arrives from the server.
  const [items, setItems] = useState<Items>(serverItems)
  const [activeId, setActiveId] = useState<number | null>(null)
  const origin = useRef<string | null>(null)
  const dragging = useRef(false)
  // Cards drawn per column; scrolling a column to its end draws the next page.
  const [limits, setLimits] = useState<Record<string, number>>({})
  const limitOf = (columnId: string) => limits[columnId] ?? PAGE_SIZE
  const showMore = useCallback(
    (columnId: string) => setLimits((prev) => ({ ...prev, [columnId]: (prev[columnId] ?? PAGE_SIZE) + PAGE_SIZE })),
    [],
  )
  /** Draws a column at least up to `index`, so a card dropped there doesn't vanish among undrawn ones. */
  const reveal = (columnId: string, index: number) =>
    setLimits((prev) => {
      const limit = prev[columnId] ?? PAGE_SIZE
      return index < limit ? prev : { ...prev, [columnId]: Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE }
    })
  const columnHeight = useColumnHeight()

  useEffect(() => {
    if (!dragging.current) setItems(serverItems)
  }, [serverItems])

  // Order of the movable columns, kept locally after a drop until the server's order arrives.
  const serverColumnOrder = useMemo(() => columns.filter((c) => c.movable).map((c) => c.id), [columns])
  const [columnOrder, setColumnOrder] = useState(serverColumnOrder)
  useEffect(() => setColumnOrder(serverColumnOrder), [serverColumnOrder])
  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]))
    let next = 0
    // Fixed columns keep their place; movable ones fill their slots in local order.
    return columns.map((c) => (c.movable ? (byId.get(columnOrder[next++]) ?? c) : c))
  }, [columns, columnOrder])

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
    if (isColumnDrag(active.id)) return
    dragging.current = true
    setActiveId(active.id as number)
    origin.current = findColumn(active.id) ?? null
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || isColumnDrag(active.id)) return
    const from = findColumn(active.id)
    const to = findColumn(over.id)
    if (!from || !to || from === to) return

    const toItems = [...items[to]]
    const overIndex = typeof over.id === 'string' ? -1 : toItems.indexOf(over.id as number)
    const translated = active.rect.current.translated
    const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2
    // Dropped on the column itself: right after the cards drawn so far.
    const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : Math.min(toItems.length, limitOf(to))
    toItems.splice(index, 0, active.id as number)
    reveal(to, index)
    setItems({ ...items, [from]: items[from].filter((id) => id !== active.id), [to]: toItems })
  }

  function onColumnDragEnd(activeId: UniqueIdentifier, overId: UniqueIdentifier | undefined) {
    if (overId === undefined || !isColumnDrag(overId) || activeId === overId) return
    const id = String(activeId).slice(COLUMN_PREFIX.length)
    const from = columnOrder.indexOf(id)
    const to = columnOrder.indexOf(String(overId).slice(COLUMN_PREFIX.length))
    if (from < 0 || to < 0) return
    const next = arrayMove(columnOrder, from, to)
    setColumnOrder(next)
    onMoveColumn?.({ columnId: id, before: next[to - 1] ?? null, after: next[to + 1] ?? null })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (isColumnDrag(active.id)) return onColumnDragEnd(active.id, over?.id)
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
    reveal(column, index)
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
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div ref={columnHeight.ref} data-board-scroller className="-mx-10 -mt-2 overflow-x-auto px-10 pb-4 pt-2">
        <SortableContext items={columnOrder.map(columnDragId)} strategy={horizontalListSortingStrategy}>
        <div className="flex items-start gap-3">
          {orderedColumns.map((c) => (
            <Column
              key={c.id}
              column={c}
              ids={items[c.id] ?? []}
              limit={limitOf(c.id)}
              onShowMore={showMore}
              maxHeight={columnHeight.value}
              taskById={taskById}
              className={columnClassName}
              display={display}
            />
          ))}
        </div>
        </SortableContext>
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
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
  /** the board being shown, so cards don't repeat it in their board chips */
  boardId?: number
}

const PAGE_SIZE = 25

/**
 * Height that lets columns end just above the bottom of the window, so a long column scrolls
 * inside itself instead of making the page tall. Measured from where the board starts on the page.
 */
function useColumnHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current
      if (!el) return
      const scroller = el.parentElement?.closest<HTMLElement>('.overflow-y-auto')
      // Position within the scrolling page, so scrolling doesn't change it.
      const top = el.getBoundingClientRect().top + (scroller?.scrollTop ?? 0) - (scroller?.getBoundingClientRect().top ?? 0)
      const viewport = scroller?.clientHeight ?? window.innerHeight
      const next = Math.max(360, Math.round(viewport - top - 24))
      setValue((prev) => (prev === next ? prev : next))
    }
    measure()
    // Things above the board (filters, notices) can change its position.
    const observer = new ResizeObserver(measure)
    const scroller = ref.current?.parentElement?.closest<HTMLElement>('.overflow-y-auto')
    if (scroller) observer.observe(scroller)
    if (ref.current?.parentElement) observer.observe(ref.current.parentElement)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return { ref, value }
}

function Column({ column, ids, limit, onShowMore, maxHeight, taskById, className, display }: {
  column: BoardColumn
  ids: number[]
  limit: number
  onShowMore: (columnId: string) => void
  maxHeight: number | undefined
  taskById: Map<number, Task>
  className: string
  display: CardDisplay
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const sortable = useSortable({ id: columnDragId(column.id), disabled: !column.movable })
  // Pressing the header already shows the lifted look; the drag itself starts after a few pixels.
  const [pressed, setPressed] = useState(false)
  const lifted = sortable.isDragging || pressed
  useEffect(() => {
    if (!pressed) return
    const release = () => setPressed(false)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [pressed])
  const tasks = ids.map((id) => taskById.get(id)).filter((t): t is Task => t !== undefined)
  const count = column.countAll ? tasks.length : tasks.filter((t) => t.status !== 'done').length
  const visibleIds = useMemo(() => ids.slice(0, limit), [ids, limit])
  const visible = visibleIds.map((id) => taskById.get(id)).filter((t): t is Task => t !== undefined)
  const hidden = ids.length - visibleIds.length

  // Draw the next page when the end of the column scrolls into view.
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || hidden === 0) return
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && onShowMore(column.id), {
      root: listRef.current,
      rootMargin: '0px 0px 240px 0px',
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hidden, limit, column.id, onShowMore])

  return (
    <div
      ref={sortable.setNodeRef}
      data-column={column.id}
      style={{ maxHeight, transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={`group/col flex shrink-0 flex-col rounded-2xl border transition-colors ${className} ${
        lifted
          ? 'border-accent/60 bg-surface-2'
          : column.highlight
            ? 'border-accent/40 bg-accent-soft/60'
            : 'border-line bg-surface-2'
      } ${column.pinned ? 'sticky left-0 z-10 shadow-[10px_0_20px_-14px_rgb(0_0_0/0.35)]' : ''} ${
        // The outline is the border itself: a ring outside it gets clipped by the scroller.
        lifted ? 'relative z-20 shadow-xl shadow-black/15' : ''
      }`}
    >
      <div
        // The header is the handle for moving a movable column.
        {...(column.movable ? { ...sortable.attributes, ...sortable.listeners } : {})}
        onPointerDown={(e) => {
          if (!column.movable) return
          // The rename / delete buttons in the header aren't a grab.
          if (e.button === 0 && !(e.target as Element).closest('button')) setPressed(true)
          sortable.listeners?.onPointerDown?.(e)
        }}
        // No browser focus outline: it only wraps the header and looks like a cut-off border.
        className={`flex items-start justify-between gap-2 rounded-t-2xl px-3.5 pb-1 pt-3 outline-none ${
          column.movable ? `focus-visible:bg-hover ${lifted ? 'cursor-grabbing' : 'cursor-grab'}` : ''
        }`}
        title={column.movable ? 'Taşımak için sürükle' : undefined}
      >
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
          <CountPill tone={column.highlight ? 'accent' : 'default'}>{count}</CountPill>
        </div>
      </div>

      <SortableContext id={column.id} items={visibleIds} strategy={verticalListSortingStrategy}>
        <div
          ref={(el) => {
            setNodeRef(el)
            listRef.current = el
          }}
          className={`m-1.5 flex min-h-28 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-xl p-1 transition-colors ${
            isOver ? 'bg-accent/8' : ''
          }`}
        >
          {visible.map((t) => (
            <SortableCard key={t.id} task={t} display={display} />
          ))}
          {hidden > 0 && (
            <div ref={sentinelRef} className="flex justify-center py-2 text-[11px] text-fg-faint">
              {hidden} görev daha…
            </div>
          )}
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

export function TaskCard({ task, overlay = false, showProject = true, showSchedule = true, showStatus = true, boardId }: {
  task: Task
  overlay?: boolean
} & CardDisplay) {
  const { open, taskId } = useTaskPanel()
  const done = task.status === 'done'
  const selected = taskId === task.id
  const meta = taskMetaChips(task, { showProject, showSchedule, showStatus, boardId })
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
