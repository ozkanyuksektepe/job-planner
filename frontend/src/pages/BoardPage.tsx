import { CalendarClock, CheckCircle2, Columns3, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Board, { sortOrderBetween, type BoardColumn, type BoardMove } from '../components/Board'
import FilterBar from '../components/FilterBar'
import NameDialog from '../components/NameDialog'
import { TaskCompleteContext } from '../components/TaskItem'
import { Button, EmptyState, ErrorBox, Page, PageHeader, Spinner } from '../components/ui'
import type { BoardColumn as Column, Task } from '../lib/api'
import { useTaskFilters } from '../lib/filters'
import {
  useBoard, useCreateBoardColumn, useDeleteBoard, useDeleteBoardColumn, usePlaceTask, useRenameBoard, useRenameBoardColumn,
  useUnplaceTask, useUpdateTask,
} from '../lib/hooks'

// Fixed column ids; user columns are "col-<id>".
const UNPLACED = 'unplaced'
const DONE = 'done'
const columnKey = (id: number) => `col-${id}`

type Dialog = { kind: 'renameBoard' } | { kind: 'addColumn' } | { kind: 'renameColumn'; column: Column } | null

export default function BoardPage() {
  const boardId = Number(useParams().boardId)
  const { data: board, isLoading, error } = useBoard(boardId)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<Dialog>(null)
  const filter = useTaskFilters()
  const { apply, defaults } = filter

  // `mutate` functions are stable, so they can be memo dependencies without resetting the board.
  const { mutate: updateTask } = useUpdateTask()
  const { mutate: placeTask } = usePlaceTask()
  const { mutate: unplaceTask } = useUnplaceTask()
  const { mutate: deleteColumn } = useDeleteBoardColumn()
  const renameBoard = useRenameBoard()
  const deleteBoard = useDeleteBoard()
  const addColumn = useCreateBoardColumn()
  const renameColumn = useRenameBoardColumn()

  const itemByTask = useMemo(() => new Map((board?.items ?? []).map((i) => [i.task_id, i])), [board])

  // Checking a task anywhere on the board files it under "Tamamlananlar";
  // unchecking sends it back to the column it came from.
  const onComplete = useCallback(
    (task: Task, done: boolean) => {
      updateTask({ id: task.id, patch: { status: done ? 'done' : 'todo' } })
      if (done && !itemByTask.has(task.id)) placeTask({ boardId, taskId: task.id, columnId: null })
    },
    [updateTask, placeTask, itemByTask, boardId],
  )

  const columns = useMemo<BoardColumn[]>(() => {
    if (!board) return []
    // Board order replaces the task's own sort order inside user columns.
    const withBoardOrder = (t: Task): Task => ({ ...t, sort_order: itemByTask.get(t.id)?.sort_order ?? t.sort_order })
    const tasks = apply(board.tasks)
    const open = tasks.filter((t) => t.status !== 'done').map(withBoardOrder)
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
        title: c.name,
        tasks: inColumn(c.id),
        quickAdd: defaults,
        onCreated: (task: Task) => placeTask({ boardId, taskId: task.id, columnId: c.id }),
        actions: (
          <>
            <button
              type="button"
              onClick={() => setDialog({ kind: 'renameColumn', column: c })}
              className="flex size-6 items-center justify-center rounded-md text-fg-faint hover:bg-hover hover:text-fg"
              title="Alanı yeniden adlandır"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${c.name}" alanı silinsin mi? İçindeki görevler silinmez, Planlanmamış'a döner.`)) {
                  deleteColumn({ boardId, columnId: c.id })
                }
              }}
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
        tasks: tasks
          .filter((t) => t.status === 'done')
          .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
      },
    ]
  }, [board, itemByTask, boardId, placeTask, deleteColumn, apply, defaults])

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
      columnId: Number(columnId.slice('col-'.length)),
      sortOrder: sortOrderBetween(before, after, item?.sort_order ?? 0),
    })
  }

  async function removeBoard() {
    if (!board || !confirm(`"${board.name}" panosu silinsin mi? Görevler silinmez, sadece bu pano kaldırılır.`)) return
    await deleteBoard.mutateAsync(boardId)
    navigate('/today')
  }

  if (isLoading) return <Page><Spinner /></Page>
  if (error || !board) return <Page><ErrorBox error={error ?? 'Pano bulunamadı'} /></Page>

  return (
    <Page width="full">
      <PageHeader
        eyebrow="Pano"
        title={board.name}
        subtitle={`${board.open_tasks} açık görev · ${board.columns.length} alan`}
        actions={
          <>
            <Button variant="primary" onClick={() => setDialog({ kind: 'addColumn' })}>
              <Plus className="size-4" /> Alan ekle
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDialog({ kind: 'renameBoard' })} title="Panoyu yeniden adlandır">
              <Pencil className="size-4" />
            </Button>
            <Button variant="danger" size="icon" onClick={removeBoard} title="Panoyu sil">
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      {board.columns.length === 0 && (
        <div className="mb-6 rounded-2xl border border-dashed border-line">
          <EmptyState
            icon={<Columns3 className="size-6" />}
            title="Henüz alan yok"
            hint="Sağ üstteki “Alan ekle” ile Yapılacaklar, Önemli gibi alanlar oluştur; sonra görevleri sürükleyip bırak."
          />
        </div>
      )}

      <FilterBar
        state={filter}
        shown={apply(board.tasks).length + apply(board.unplaced).length}
        total={board.tasks.length + board.unplaced.length}
      />

      <TaskCompleteContext.Provider value={onComplete}>
        <Board columns={columns} onMove={onMove} columnClassName="w-64" />
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
        <NameDialog
          title="Yeni alan"
          placeholder="örn. Yapılacaklar, Önemli"
          submitLabel="Ekle"
          onSubmit={(name) => addColumn.mutateAsync({ boardId, name })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'renameColumn' && (
        <NameDialog
          title="Alanı yeniden adlandır"
          initial={dialog.column.name}
          onSubmit={(name) => renameColumn.mutateAsync({ boardId, columnId: dialog.column.id, name })}
          onClose={() => setDialog(null)}
        />
      )}
    </Page>
  )
}
