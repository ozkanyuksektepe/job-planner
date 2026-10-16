import { CalendarClock, CheckCircle2, Columns3, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Board, { sortOrderBetween, type BoardColumn, type BoardMove, type ColumnMove } from './Board'
import FilterBar from './FilterBar'
import ColumnDialog from './ColumnDialog'
import NameDialog from './NameDialog'
import { TaskCompleteContext } from './TaskItem'
import { Button, ErrorBox, Spinner } from './ui'
import type { BoardColumn as Column, Task } from '../lib/api'
import { useTaskFilters } from '../lib/filters'
import {
  useBoard, useCreateBoardColumn, useMoveBoardColumn, usePlaceTask, useRenameBoard, useUpdateBoardColumn,
  useUnplaceTask, useUpdateTask,
} from '../lib/hooks'
import { deleteWithUndo } from '../lib/undo'

// Fixed column ids; user columns are "col-<id>".
const UNPLACED = 'unplaced'
const DONE = 'done'
const columnKey = (id: number) => `col-${id}`
const columnIdOf = (key: string) => Number(key.slice('col-'.length))

type Dialog = { kind: 'renameBoard' } | { kind: 'addColumn' } | { kind: 'editColumn'; column: Column } | null

/** A project's board: user columns ("alanlar") plus "Planlanmamış" and "Tamamlananlar". */
export default function ProjectBoard({ projectId, boardId }: { projectId: number; boardId: number }) {
  const { data: board, isLoading, error } = useBoard(boardId)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<Dialog>(null)
  // The board only holds this project's tasks, so the project filter is meaningless here.
  const filter = useTaskFilters(['project'])
  const { apply } = filter
  // New tasks go to this project so they can show up on its board.
  const defaults = useMemo(() => ({ ...filter.defaults, project_id: projectId }), [filter.defaults, projectId])

  // `mutate` functions are stable, so they can be memo dependencies without resetting the board.
  const { mutate: updateTask } = useUpdateTask()
  const { mutate: placeTask } = usePlaceTask()
  const { mutate: unplaceTask } = useUnplaceTask()
  const { mutate: moveColumn } = useMoveBoardColumn()
  const renameBoard = useRenameBoard()
  const addColumn = useCreateBoardColumn()
  const updateColumn = useUpdateBoardColumn()

  const itemByTask = useMemo(() => new Map((board?.items ?? []).map((i) => [i.task_id, i])), [board])

  // Checking a task anywhere on the board files it under "Tamamlananlar";
  // unchecking sends it back to the column it came from.
  const onComplete = useCallback(
    (task: Task, done: boolean) => {
      updateTask({ id: task.id, patch: { status: done ? 'done' : 'todo' } })
      // An inbox task (no project) is only completed; placing it would move it into this project.
      if (done && !itemByTask.has(task.id) && task.project_id !== null) placeTask({ boardId, taskId: task.id, columnId: null })
    },
    [updateTask, placeTask, itemByTask, boardId],
  )

  const columns = useMemo<BoardColumn[]>(() => {
    if (!board) return []
    // Board order replaces the task's own sort order inside user columns.
    const withBoardOrder = (t: Task): Task => ({ ...t, sort_order: itemByTask.get(t.id)?.sort_order ?? t.sort_order })
    const tasks = apply(board.tasks)
    const open = tasks.filter((t) => t.status !== 'done').map(withBoardOrder)
    const done = tasks
      .filter((t) => t.status === 'done')
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    const inColumn = (columnId: number | null) =>
      open.filter((t) => (itemByTask.get(t.id)?.column_id ?? null) === columnId).sort((a, b) => a.sort_order - b.sort_order)

    return [
      {
        id: UNPLACED,
        title: 'Planlanmamış',
        subtitle: 'Bir alana sürükleyip bırak',
        icon: <CalendarClock className="size-3.5 text-fg-faint" />,
        pinned: true,
        tasks: [...inColumn(null), ...apply(board.unplaced)],
        quickAdd: defaults,
      },
      ...board.columns.map((c) => ({
        id: columnKey(c.id),
        movable: true,
        color: c.color,
        title: c.name,
        tasks: inColumn(c.id),
        quickAdd: defaults,
        onCreated: (task: Task) => placeTask({ boardId, taskId: task.id, columnId: c.id }),
        actions: (
          <>
            <button
              type="button"
              onClick={() => setDialog({ kind: 'editColumn', column: c })}
              className="flex size-6 items-center justify-center rounded-md text-fg-faint hover:bg-hover hover:text-fg"
              title="Alanı düzenle"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                deleteWithUndo({
                  kind: 'column',
                  id: c.id,
                  endpoint: `/boards/${boardId}/columns/${c.id}`,
                  message: `"${c.name}" alanı silindi`,
                })
              }
              className="flex size-6 items-center justify-center rounded-md text-fg-faint hover:bg-rose-500/10 hover:text-rose-500"
              title="Alanı sil"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        ),
      })),
      {
        id: DONE,
        title: 'Tamamlananlar',
        icon: <CheckCircle2 className="size-3.5 text-emerald-500" />,
        // Most recently completed first.
        tasks: done,
        countAll: true,
      },
    ]
  }, [board, itemByTask, boardId, placeTask, apply, defaults])

  function onMove({ task, columnId, before, after, changedColumn }: BoardMove) {
    const item = itemByTask.get(task.id)
    const wasDone = task.status === 'done'

    if (columnId === DONE) {
      if (changedColumn) onComplete(task, true)
      return
    }
    if (wasDone) updateTask({ id: task.id, patch: { status: 'todo' } })

    if (columnId === UNPLACED) {
      // Order inside "Planlanmamış" isn't stored; only leaving the board matters.
      if (changedColumn && item) unplaceTask({ boardId, taskId: task.id })
      return
    }
    placeTask({
      boardId,
      taskId: task.id,
      columnId: columnIdOf(columnId),
      sortOrder: sortOrderBetween(before, after, item?.sort_order ?? 0),
    })
  }

  // New position halfway between the neighbouring areas, like task sort orders.
  function onMoveColumn({ columnId, before, after }: ColumnMove) {
    if (!board) return
    const positionOf = (key: string | null) => board.columns.find((c) => key !== null && c.id === columnIdOf(key))?.position
    const prev = positionOf(before)
    const next = positionOf(after)
    const position =
      prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1 : next !== undefined ? next - 1 : 0
    moveColumn({ boardId, columnId: columnIdOf(columnId), position })
  }

  function removeBoard() {
    if (!board) return
    deleteWithUndo({ kind: 'board', id: boardId, endpoint: `/boards/${boardId}`, message: `"${board.name}" panosu silindi` })
    navigate(`/projects/${projectId}`)
  }

  if (isLoading) return <Spinner />
  if (error || !board || board.project_id !== projectId) return <ErrorBox error={error ?? 'Pano bulunamadı'} />

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{board.name}</h2>
          <p className="text-xs text-fg-muted">
            {board.open_tasks} açık görev · {board.columns.length} alan
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setDialog({ kind: 'renameBoard' })} title="Panoyu yeniden adlandır">
            <Pencil className="size-4" />
          </Button>
          <Button variant="danger" size="icon" onClick={removeBoard} title="Panoyu sil">
            <Trash2 className="size-4" />
          </Button>
          <Button variant="primary" className="ml-1.5" onClick={() => setDialog({ kind: 'addColumn' })}>
            <Plus className="size-4" /> Alan ekle
          </Button>
        </div>
      </div>

      {board.columns.length === 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-line px-3.5 py-2.5">
          <Columns3 className="size-4 shrink-0 text-fg-faint" />
          <p className="min-w-0 flex-1 text-[13px] text-fg-muted">
            <span className="font-medium text-fg">Henüz alan yok.</span> Yapılacaklar, Önemli gibi alanlar oluştur; sonra görevleri
            sürükleyip bırak.
          </p>
          <Button size="sm" onClick={() => setDialog({ kind: 'addColumn' })}>
            <Plus className="size-3.5" /> Alan ekle
          </Button>
        </div>
      )}

      <FilterBar
        state={filter}
        shown={apply(board.tasks).length + apply(board.unplaced).length}
        total={board.tasks.length + board.unplaced.length}
      />

      <TaskCompleteContext.Provider value={onComplete}>
        <Board columns={columns} onMove={onMove} onMoveColumn={onMoveColumn} showProject={false} markInbox boardId={boardId} columnClassName="w-64" />
      </TaskCompleteContext.Provider>

      {dialog?.kind === 'renameBoard' && (
        <NameDialog
          title="Panoyu yeniden adlandır"
          initial={board.name}
          onSubmit={(name) => renameBoard.mutateAsync({ id: boardId, name })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'addColumn' && (
        <ColumnDialog
          title="Yeni alan"
          submitLabel="Ekle"
          onSubmit={({ name, color }) => addColumn.mutateAsync({ boardId, name, color })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'editColumn' && (
        <ColumnDialog
          title="Alanı düzenle"
          initialName={dialog.column.name}
          initialColor={dialog.column.color}
          onSubmit={({ name, color }) => updateColumn.mutateAsync({ boardId, columnId: dialog.column.id, name, color })}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
