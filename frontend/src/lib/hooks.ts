import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type NoteInput, type NotePatch, type Project, type ProjectInput, type TaskInput, type TaskListParams, type TaskPatch } from './api'

export const keys = {
  projects: ['projects'] as const,
  projectList: (status?: string) => ['projects', 'list', status ?? 'all'] as const,
  project: (id: number) => ['projects', 'one', id] as const,
  tasks: ['tasks'] as const,
  taskList: (p: TaskListParams) => ['tasks', 'list', p] as const,
  today: (date: string) => ['tasks', 'today', date] as const,
  task: (id: number) => ['tasks', 'one', id] as const,
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

/** Any task change can affect lists, today view, parent subtask counts and project counts. */
function useInvalidateTasks() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: keys.tasks })
    qc.invalidateQueries({ queryKey: keys.projects })
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
