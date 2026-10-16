import { Archive, ArchiveRestore, Columns3, List, ListTodo, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import FilterBar from '../components/FilterBar'
import NameDialog from '../components/NameDialog'
import NoteGrid from '../components/NoteGrid'
import ProjectBoard from '../components/ProjectBoard'
import ProjectDialog from '../components/ProjectDialog'
import QuickAdd from '../components/QuickAdd'
import TaskList from '../components/TaskList'
import { Button, Chip, ErrorBox, Page, Spinner } from '../components/ui'
import type { Project } from '../lib/api'
import { useTaskFilters } from '../lib/filters'
import { useCreateBoard, useCreateNote, useDeleteProject, useNotes, useProject, useProjectBoards, useTasks, useUpdateProject } from '../lib/hooks'
import { confirmDialog } from '../components/ConfirmDialog'

export default function ProjectPage({ tab }: { tab: 'tasks' | 'notes' }) {
  const params = useParams()
  const id = Number(params.projectId)
  // On /projects/:id/boards/:boardId the tasks tab shows that board instead of the list.
  const boardId = params.boardId ? Number(params.boardId) : null
  const { data: project, isLoading, error } = useProject(id)
  const [editing, setEditing] = useState(false)
  const update = useUpdateProject()
  const remove = useDeleteProject()
  const navigate = useNavigate()

  if (isLoading) return <Page><Spinner /></Page>
  if (error || !project) return <Page><ErrorBox error={error ?? 'Proje bulunamadı'} /></Page>

  const total = project.open_tasks + project.done_tasks
  const pct = total ? Math.round((project.done_tasks / total) * 100) : 0
  const archived = project.status === 'archived'

  async function deleteProject() {
    const ok = await confirmDialog({
      title: `"${project!.name}" projesi silinsin mi?`,
      message: 'Projenin tüm görevleri ve notları da silinecek. Bu işlem geri alınamaz.',
    })
    if (!ok) return
    await remove.mutateAsync(id)
    navigate('/today')
  }

  const board = tab === 'tasks' && boardId !== null

  return (
    <Page width={board ? 'full' : 'narrow'}>
      <header className="mb-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold text-white shadow-sm"
            style={{ backgroundColor: project.color, boxShadow: `0 6px 20px -6px ${project.color}` }}
          >
            {project.name.charAt(0).toLocaleUpperCase('tr-TR')}
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title="Düzenle">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => update.mutate({ id, patch: { status: archived ? 'active' : 'archived' } })}
              title={archived ? 'Arşivden çıkar' : 'Arşivle'}
            >
              {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button variant="danger" size="icon" onClick={deleteProject} title="Sil">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight">{project.name}</h1>
          {archived && <Chip>Arşivde</Chip>}
        </div>
        {project.description && <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{project.description}</p>}

        {total > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: project.color }}
              />
            </div>
            <span className="text-xs tabular-nums text-fg-muted">
              <span className="font-semibold text-fg">%{pct}</span> · {project.done_tasks}/{total} görev
            </span>
          </div>
        )}
      </header>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-hover p-1">
          {[
            { to: `/projects/${id}`, label: 'Görevler', icon: <ListTodo className="size-4" />, active: tab === 'tasks' },
            { to: `/projects/${id}/notes`, label: 'Notlar', icon: <NotebookPen className="size-4" />, active: tab === 'notes' },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                t.active ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {t.icon}
              {t.label}
            </NavLink>
          ))}
        </div>
        {tab === 'tasks' && <ViewSwitcher projectId={id} boardId={boardId} />}
      </div>

      {tab === 'notes' ? (
        <ProjectNotes project={project} />
      ) : board ? (
        <ProjectBoard key={boardId} projectId={id} boardId={boardId} />
      ) : (
        <ProjectTasks projectId={id} />
      )}

      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} />}
    </Page>
  )
}

/** "Liste" plus one tab per board of the project, and "+ Pano" to create one. */
function ViewSwitcher({ projectId, boardId }: { projectId: number; boardId: number | null }) {
  const { data: boards = [] } = useProjectBoards(projectId)
  const create = useCreateBoard()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const item = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
      active ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-fg-muted hover:text-fg'
    }`

  return (
    <>
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg bg-hover p-0.5">
        <NavLink to={`/projects/${projectId}`} className={item(boardId === null)}>
          <List className="size-3.5" /> Liste
        </NavLink>
        {boards.map((b) => (
          <NavLink key={b.id} to={`/projects/${projectId}/boards/${b.id}`} className={item(boardId === b.id)} title={b.name}>
            <Columns3 className="size-3.5" />
            <span className="max-w-36 truncate">{b.name}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setCreating(true)} className={item(false)} title="Yeni pano">
          <Plus className="size-3.5" /> Pano
        </button>
      </div>
      {creating && (
        <NameDialog
          title="Yeni pano"
          placeholder="örn. Sprint, Yol haritası"
          submitLabel="Oluştur"
          onSubmit={async (name) => {
            const board = await create.mutateAsync({ projectId, name })
            navigate(`/projects/${projectId}/boards/${board.id}`)
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  )
}

function ProjectTasks({ projectId }: { projectId: number }) {
  const { data, isLoading, error } = useTasks({ project_id: projectId })
  const filter = useTaskFilters(['project'])
  const tasks = filter.apply(data ?? [])
  return (
    <>
      <QuickAdd defaults={{ ...filter.defaults, project_id: projectId }} placeholder="Projeye görev ekle…" />
      <FilterBar state={filter} shown={tasks.length} total={data?.length} />
      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {data && (
        <TaskList tasks={tasks} showProject={false} sortable emptyText={filter.active ? 'Filtreye uyan açık görev yok' : 'Açık görev yok'} />
      )}
    </>
  )
}

function ProjectNotes({ project }: { project: Project }) {
  const { data, isLoading, error } = useNotes(project.id)
  const create = useCreateNote()
  const navigate = useNavigate()

  async function newNote() {
    const note = await create.mutateAsync({ project_id: project.id })
    navigate(`/notes/${note.id}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={newNote}
        disabled={create.isPending}
        className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-medium text-fg-muted transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent-fg"
      >
        <Plus className="size-4" /> Yeni not
      </button>
      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {data && <NoteGrid notes={data} showProject={false} />}
    </>
  )
}
