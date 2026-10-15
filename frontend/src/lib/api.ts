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
  tags: TagRef[]
}

export interface TagRef {
  id: number
  name: string
  color: string
}

export interface Tag extends TagRef {
  open_tasks: number
}

export interface Board {
  id: number
  name: string
  created_at: string
  open_tasks: number
}

export interface BoardColumn {
  id: number
  board_id: number
  name: string
  position: number
}

/** A task's place on a board; column_id null = on the board but in no user column. */
export interface BoardItem {
  task_id: number
  column_id: number | null
  sort_order: number
}

export interface BoardView extends Board {
  columns: BoardColumn[]
  items: BoardItem[]
  /** tasks placed on the board, any status */
  tasks: Task[]
  /** open, unscheduled top-level tasks not on this board yet */
  unplaced: Task[]
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
> & { title: string; tag_ids?: number[] }
export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'scheduled_date' | 'project_id' | 'sort_order'>
> & { tag_ids?: number[] }
export type TagInput = Partial<Pick<Tag, 'name' | 'color'>>
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
  tag_id?: number
  inbox?: boolean
  /** open top-level tasks whose day (see taskDay) is before this date: the week view's "Bekleyenler" */
  backlog_before?: string
  /** date range (YYYY-MM-DD, inclusive) of task days (see taskDay), completed tasks included */
  from?: string
  to?: string
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
  tags: {
    list: () => request<Tag[]>('GET', '/tags'),
    get: (id: number) => request<Tag>('GET', `/tags/${id}`),
    create: (input: TagInput) => request<Tag>('POST', '/tags', input),
    update: (id: number, patch: TagInput) => request<Tag>('PATCH', `/tags/${id}`, patch),
    remove: (id: number) => request<void>('DELETE', `/tags/${id}`),
  },
  boards: {
    list: () => request<Board[]>('GET', '/boards'),
    get: (id: number) => request<BoardView>('GET', `/boards/${id}`),
    create: (name: string) => request<Board>('POST', '/boards', { name }),
    rename: (id: number, name: string) => request<Board>('PATCH', `/boards/${id}`, { name }),
    remove: (id: number) => request<void>('DELETE', `/boards/${id}`),
    createColumn: (id: number, name: string) => request<BoardColumn>('POST', `/boards/${id}/columns`, { name }),
    updateColumn: (id: number, columnId: number, patch: Partial<Pick<BoardColumn, 'name' | 'position'>>) =>
      request<BoardColumn>('PATCH', `/boards/${id}/columns/${columnId}`, patch),
    removeColumn: (id: number, columnId: number) => request<void>('DELETE', `/boards/${id}/columns/${columnId}`),
    place: (id: number, taskId: number, columnId: number | null, sortOrder?: number) =>
      request<BoardItem>('PUT', `/boards/${id}/items/${taskId}`, { column_id: columnId, sort_order: sortOrder }),
    unplace: (id: number, taskId: number) => request<void>('DELETE', `/boards/${id}/items/${taskId}`),
  },
  notes: {
    list: (projectId?: number) => request<Note[]>('GET', '/notes' + query({ project_id: projectId })),
    get: (id: number) => request<Note>('GET', `/notes/${id}`),
    create: (input: NoteInput) => request<Note>('POST', '/notes', input),
    update: (id: number, patch: NotePatch) => request<Note>('PATCH', `/notes/${id}`, patch),
    remove: (id: number) => request<void>('DELETE', `/notes/${id}`),
  },
}
