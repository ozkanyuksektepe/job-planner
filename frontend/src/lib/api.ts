export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Project {
  id: number
  name: string
  description: string
  color: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  open_tasks: number
  done_tasks: number
}

export interface Task {
  id: number
  project_id: number | null
  parent_id: number | null
  title: string
  description: string
  status: TaskStatus
  priority: number // 0 none, 1 low, 2 medium, 3 high
  due_date: string | null
  scheduled_date: string | null
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
  project_name: string | null
  project_color: string | null
  parent_title: string | null
  subtask_count: number
  subtask_done: number
}

export interface Note {
  id: number
  project_id: number | null
  title: string
  content: string // TipTap JSON document
  pinned: boolean
  created_at: string
  updated_at: string
  project_name: string | null
  project_color: string | null
}

export interface TodayView {
  date: string
  overdue: Task[]
  today: Task[]
}

export type ProjectInput = Pick<Project, 'name' | 'description' | 'color'>
export type TaskInput = Partial<
  Pick<Task, 'project_id' | 'parent_id' | 'description' | 'status' | 'priority' | 'due_date' | 'scheduled_date'>
> & { title: string }
export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'scheduled_date' | 'project_id' | 'sort_order'>
>
export type NoteInput = Partial<Pick<Note, 'project_id' | 'title' | 'content'>>
export type NotePatch = Partial<Pick<Note, 'project_id' | 'title' | 'content' | 'pinned'>>

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = (await res.json()).error ?? msg
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== false) q.set(k, v === true ? '1' : String(v))
  }
  const s = q.toString()
  return s ? '?' + s : ''
}

export interface TaskListParams {
  project_id?: number
  parent_id?: number
  inbox?: boolean
}

export const api = {
  projects: {
    list: (status?: Project['status']) => request<Project[]>('GET', '/projects' + query({ status })),
    get: (id: number) => request<Project>('GET', `/projects/${id}`),
    create: (input: ProjectInput) => request<Project>('POST', '/projects', input),
    update: (id: number, patch: Partial<ProjectInput & Pick<Project, 'status'>>) =>
      request<Project>('PATCH', `/projects/${id}`, patch),
    remove: (id: number) => request<void>('DELETE', `/projects/${id}`),
  },
  tasks: {
    list: (params: TaskListParams) => request<Task[]>('GET', '/tasks' + query({ ...params })),
    today: (date: string) => request<TodayView>('GET', '/today' + query({ date })),
    get: (id: number) => request<Task>('GET', `/tasks/${id}`),
    create: (input: TaskInput) => request<Task>('POST', '/tasks', input),
    update: (id: number, patch: TaskPatch) => request<Task>('PATCH', `/tasks/${id}`, patch),
    remove: (id: number) => request<void>('DELETE', `/tasks/${id}`),
  },
  notes: {
    list: (projectId?: number) => request<Note[]>('GET', '/notes' + query({ project_id: projectId })),
    get: (id: number) => request<Note>('GET', `/notes/${id}`),
    create: (input: NoteInput) => request<Note>('POST', '/notes', input),
    update: (id: number, patch: NotePatch) => request<Note>('PATCH', `/notes/${id}`, patch),
    remove: (id: number) => request<void>('DELETE', `/notes/${id}`),
  },
}
