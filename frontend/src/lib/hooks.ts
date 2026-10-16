import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  api, type Attachment, type AttachmentOwner, type Board, type BoardView, type Note, type NoteInput, type NotePatch, type Project,
  type ProjectInput, type Tag, type TagInput, type Task, type TaskInput, type TaskListParams, type TaskPatch, type TodayView,
} from './api'
import { usePendingDeletes, type PendingSets } from './undo'

export const keys = {
  projects: ['projects'] as const,
  projectList: (status?: string) => ['projects', 'list', status ?? 'all'] as const,
  project: (id: number) => ['projects', 'one', id] as const,
  tasks: ['tasks'] as const,
  taskList: (p: TaskListParams) => ['tasks', 'list', p] as const,
  today: (date: string) => ['tasks', 'today', date] as const,
  task: (id: number) => ['tasks', 'one', id] as const,
  attachments: (owner: AttachmentOwner) => ['attachments', owner.type, owner.id] as const,
  tags: ['tags'] as const,
  tag: (id: number) => ['tags', 'one', id] as const,
  boards: ['boards'] as const,
  board: (id: number) => ['boards', 'one', id] as const,
  projectBoards: (projectId: number) => ['boards', 'project', projectId] as const,
  notes: ['notes'] as const,
  noteList: (projectId?: number) => ['notes', 'list', projectId ?? 'all'] as const,
  note: (id: number) => ['notes', 'one', id] as const,
}

// --- items waiting to be deleted (lib/undo.ts) are hidden from every query ---

const nothingPending = (p: PendingSets) => Object.values(p).every((set) => set.size === 0)

/** Drops pending tasks (and subtasks of pending tasks) and references to pending tags, boards and areas. */
function visibleTasks(tasks: Task[], p: PendingSets): Task[] {
  if (nothingPending(p)) return tasks
  return tasks
    .filter((t) => !p.task.has(t.id) && !(t.parent_id !== null && p.task.has(t.parent_id)))
    .map((t) => cleanTask(t, p))
}

function cleanTask(t: Task, p: PendingSets): Task {
  if (p.tag.size === 0 && p.board.size === 0 && p.column.size === 0) return t
  return {
    ...t,
    tags: t.tags.filter((g) => !p.tag.has(g.id)),
    boards: t.boards
      .filter((b) => !p.board.has(b.board_id))
      .map((b) => (b.column_id !== null && p.column.has(b.column_id) ? { ...b, column_id: null, column_name: null } : b)),
  }
}

function visibleBoard(v: BoardView, p: PendingSets): BoardView {
  if (nothingPending(p)) return v
  return {
    ...v,
    // A deleted area's tasks go back to "Planlanmamış", as the server will do.
    columns: v.columns.filter((c) => !p.column.has(c.id)),
    items: v.items
      .filter((i) => !p.task.has(i.task_id))
      .map((i) => (i.column_id !== null && p.column.has(i.column_id) ? { ...i, column_id: null } : i)),
    tasks: visibleTasks(v.tasks, p),
    unplaced: visibleTasks(v.unplaced, p),
  }
}

/** A `select` for useQuery that re-runs when the set of pending deletes changes. */
function usePendingFilter<T>(filter: (data: T, p: PendingSets) => T) {
  const pending = usePendingDeletes()
  return useCallback((data: T) => filter(data, pending), [filter, pending])
}

const visibleTaskList = (tasks: Task[], p: PendingSets) => visibleTasks(tasks, p)
const visibleToday = (v: TodayView, p: PendingSets): TodayView =>
  nothingPending(p) ? v : { ...v, overdue: visibleTasks(v.overdue, p), today: visibleTasks(v.today, p) }
const visibleTask = (t: Task, p: PendingSets) => cleanTask(t, p)
const visibleBoards = (boards: Board[], p: PendingSets) => (p.board.size ? boards.filter((b) => !p.board.has(b.id)) : boards)
const visibleTags = (tags: Tag[], p: PendingSets) => (p.tag.size ? tags.filter((t) => !p.tag.has(t.id)) : tags)
const visibleNotes = (notes: Note[], p: PendingSets) => (p.note.size ? notes.filter((n) => !p.note.has(n.id)) : notes)
const visibleAttachments = (list: Attachment[], p: PendingSets) =>
  p.attachment.size ? list.filter((a) => !p.attachment.has(a.id)) : list

// --- projects ---

export function useProjects(status?: Project['status']) {
  return useQuery({ queryKey: keys.projectList(status), queryFn: () => api.projects.list(status) })
}

export function useProject(id: number) {
  return useQuery({ queryKey: keys.project(id), queryFn: () => api.projects.get(id) })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInput) => api.projects.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<ProjectInput & Pick<Project, 'status'>> }) =>
      api.projects.update(id, patch),
    onSuccess: () => {
      // Project name/color is shown on tasks and notes too.
      qc.invalidateQueries({ queryKey: keys.projects })
      qc.invalidateQueries({ queryKey: keys.tasks })
      qc.invalidateQueries({ queryKey: keys.notes })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.projects.remove(id),
    onSuccess: () => qc.invalidateQueries(),
  })
}

// --- tasks ---

export function useTasks(params: TaskListParams, enabled = true) {
  const select = usePendingFilter(visibleTaskList)
  return useQuery({ queryKey: keys.taskList(params), queryFn: () => api.tasks.list(params), enabled, select })
}

export function useToday(date: string) {
  const select = usePendingFilter(visibleToday)
  return useQuery({ queryKey: keys.today(date), queryFn: () => api.tasks.today(date), select })
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: keys.task(id ?? 0),
    queryFn: () => api.tasks.get(id!),
    enabled: id !== null,
    select: usePendingFilter(visibleTask),
  })
}

/** Any task change can affect lists, today view, parent subtask counts and project / tag counts. */
function useInvalidateTasks() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: keys.tasks })
    qc.invalidateQueries({ queryKey: keys.projects })
    qc.invalidateQueries({ queryKey: keys.tags })
    qc.invalidateQueries({ queryKey: keys.boards })
  }
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({ mutationFn: (input: TaskInput) => api.tasks.create(input), onSuccess: invalidate })
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TaskPatch }) => api.tasks.update(id, patch),
    onSuccess: invalidate,
  })
}

// --- attachments ---

export function useAttachments(owner: AttachmentOwner) {
  const select = usePendingFilter(visibleAttachments)
  return useQuery({ queryKey: keys.attachments(owner), queryFn: () => api.attachments.list(owner), select })
}

/** Attachment changes also change the photo / recording counts shown on tasks and notes. */
function useInvalidateAttachments() {
  const qc = useQueryClient()
  return (owner: AttachmentOwner) => {
    qc.invalidateQueries({ queryKey: keys.attachments(owner) })
    if (owner.type === 'task') {
      qc.invalidateQueries({ queryKey: keys.tasks })
      qc.invalidateQueries({ queryKey: keys.boards })
    } else {
      qc.invalidateQueries({ queryKey: ['notes', 'list'] })
    }
  }
}

export function useUploadAttachments() {
  const invalidate = useInvalidateAttachments()
  return useMutation({
    mutationFn: ({ owner, files, durationMs }: { owner: AttachmentOwner; files: File[]; durationMs?: number }) =>
      api.attachments.upload(owner, files, durationMs),
    onSettled: (_, __, { owner }) => invalidate(owner),
  })
}


// --- tags ---

export function useTags() {
  const select = usePendingFilter(visibleTags)
  return useQuery({ queryKey: keys.tags, queryFn: api.tags.list, select })
}

export function useTag(id: number) {
  return useQuery({ queryKey: keys.tag(id), queryFn: () => api.tags.get(id) })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TagInput) => api.tags.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tags }),
  })
}

export function useUpdateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TagInput }) => api.tags.update(id, patch),
    onSuccess: () => {
      // Tag name/color is embedded in tasks.
      qc.invalidateQueries({ queryKey: keys.tags })
      qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}


// --- boards ---

export function useProjectBoards(projectId: number) {
  const select = usePendingFilter(visibleBoards)
  return useQuery({ queryKey: keys.projectBoards(projectId), queryFn: () => api.boards.list(projectId), select })
}

export function useBoard(id: number) {
  const select = usePendingFilter(visibleBoard)
  return useQuery({ queryKey: keys.board(id), queryFn: () => api.boards.get(id), select })
}

/**
 * Wraps a board API call in a mutation that refreshes all board queries afterwards,
 * plus task queries, since tasks show the boards and columns they are in.
 */
function useBoardMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.boards })
      qc.invalidateQueries({ queryKey: keys.tasks })
      // Placing an inbox task on a board moves it into the project (counts change).
      qc.invalidateQueries({ queryKey: keys.projects })
    },
  })
}

export const useCreateBoard = () =>
  useBoardMutation(({ projectId, name }: { projectId: number; name: string }) => api.boards.create(projectId, name))
export const useRenameBoard = () => useBoardMutation(({ id, name }: { id: number; name: string }) => api.boards.rename(id, name))
export const useCreateBoardColumn = () =>
  useBoardMutation(({ boardId, name, color }: { boardId: number; name: string; color: string | null }) =>
    api.boards.createColumn(boardId, name, color),
  )
export const useUpdateBoardColumn = () =>
  useBoardMutation(({ boardId, columnId, name, color }: { boardId: number; columnId: number; name: string; color: string | null }) =>
    api.boards.updateColumn(boardId, columnId, { name, color }),
  )
export const useMoveBoardColumn = () =>
  useBoardMutation(({ boardId, columnId, position }: { boardId: number; columnId: number; position: number }) =>
    api.boards.updateColumn(boardId, columnId, { position }),
  )
export const usePlaceTask = () =>
  useBoardMutation(({ boardId, taskId, columnId, sortOrder }: { boardId: number; taskId: number; columnId: number | null; sortOrder?: number }) =>
    api.boards.place(boardId, taskId, columnId, sortOrder),
  )
export const useUnplaceTask = () =>
  useBoardMutation(({ boardId, taskId }: { boardId: number; taskId: number }) => api.boards.unplace(boardId, taskId))

// --- notes ---

export function useNotes(projectId?: number) {
  const select = usePendingFilter(visibleNotes)
  return useQuery({ queryKey: keys.noteList(projectId), queryFn: () => api.notes.list(projectId), select })
}

export function useNote(id: number) {
  return useQuery({ queryKey: keys.note(id), queryFn: () => api.notes.get(id) })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NoteInput) => api.notes.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notes }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: NotePatch }) => api.notes.update(id, patch),
    onSuccess: (note) => {
      // Don't refetch the open note: the editor owns its content while typing.
      qc.setQueryData(keys.note(note.id), note)
      qc.invalidateQueries({ queryKey: ['notes', 'list'] })
    },
  })
}
