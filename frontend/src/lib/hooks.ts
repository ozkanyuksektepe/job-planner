import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api, type NoteInput, type NotePatch, type Project, type ProjectInput, type TagInput, type TaskInput, type TaskListParams, type TaskPatch,
} from './api'

export const keys = {
  projects: ['projects'] as const,
  projectList: (status?: string) => ['projects', 'list', status ?? 'all'] as const,
  project: (id: number) => ['projects', 'one', id] as const,
  tasks: ['tasks'] as const,
  taskList: (p: TaskListParams) => ['tasks', 'list', p] as const,
  today: (date: string) => ['tasks', 'today', date] as const,
  task: (id: number) => ['tasks', 'one', id] as const,
  tags: ['tags'] as const,
  tag: (id: number) => ['tags', 'one', id] as const,
  boards: ['boards'] as const,
  board: (id: number) => ['boards', 'one', id] as const,
  notes: ['notes'] as const,
  noteList: (projectId?: number) => ['notes', 'list', projectId ?? 'all'] as const,
  note: (id: number) => ['notes', 'one', id] as const,
}

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
  return useQuery({ queryKey: keys.taskList(params), queryFn: () => api.tasks.list(params), enabled })
}

export function useToday(date: string) {
  return useQuery({ queryKey: keys.today(date), queryFn: () => api.tasks.today(date) })
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: keys.task(id ?? 0),
    queryFn: () => api.tasks.get(id!),
    enabled: id !== null,
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

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({ mutationFn: (id: number) => api.tasks.remove(id), onSuccess: invalidate })
}

// --- tags ---

export function useTags() {
  return useQuery({ queryKey: keys.tags, queryFn: api.tags.list })
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

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.tags.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tags })
      qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

// --- boards ---

export function useBoards() {
  return useQuery({ queryKey: keys.boards, queryFn: api.boards.list })
}

export function useBoard(id: number) {
  return useQuery({ queryKey: keys.board(id), queryFn: () => api.boards.get(id) })
}

/** Wraps a board API call in a mutation that refreshes all board queries afterwards. */
function useBoardMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.boards }) })
}

export const useCreateBoard = () => useBoardMutation((name: string) => api.boards.create(name))
export const useRenameBoard = () => useBoardMutation(({ id, name }: { id: number; name: string }) => api.boards.rename(id, name))
export const useDeleteBoard = () => useBoardMutation((id: number) => api.boards.remove(id))
export const useCreateBoardColumn = () =>
  useBoardMutation(({ boardId, name }: { boardId: number; name: string }) => api.boards.createColumn(boardId, name))
export const useRenameBoardColumn = () =>
  useBoardMutation(({ boardId, columnId, name }: { boardId: number; columnId: number; name: string }) =>
    api.boards.updateColumn(boardId, columnId, { name }),
  )
export const useDeleteBoardColumn = () =>
  useBoardMutation(({ boardId, columnId }: { boardId: number; columnId: number }) => api.boards.removeColumn(boardId, columnId))
export const usePlaceTask = () =>
  useBoardMutation(({ boardId, taskId, columnId, sortOrder }: { boardId: number; taskId: number; columnId: number | null; sortOrder?: number }) =>
    api.boards.place(boardId, taskId, columnId, sortOrder),
  )
export const useUnplaceTask = () =>
  useBoardMutation(({ boardId, taskId }: { boardId: number; taskId: number }) => api.boards.unplace(boardId, taskId))

// --- notes ---

export function useNotes(projectId?: number) {
  return useQuery({ queryKey: keys.noteList(projectId), queryFn: () => api.notes.list(projectId) })
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

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.notes.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.note(id) })
      qc.invalidateQueries({ queryKey: ['notes', 'list'] })
    },
  })
}
