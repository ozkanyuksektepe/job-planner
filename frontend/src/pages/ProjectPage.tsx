import { Archive, ArchiveRestore, CheckCircle2, Circle, Columns3, List, ListTodo, LoaderCircle, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import Board, { sortOrderBetween, type BoardColumn, type BoardMove } from '../components/Board'
import FilterBar from '../components/FilterBar'
import NoteGrid from '../components/NoteGrid'
import ProjectDialog from '../components/ProjectDialog'
import QuickAdd from '../components/QuickAdd'
import TaskList from '../components/TaskList'
import { Button, Chip, ErrorBox, Page, Segmented, Spinner, STATUS_LABELS } from '../components/ui'
import type { Project, TaskStatus } from '../lib/api'
import { useTaskFilters } from '../lib/filters'
import { useCreateNote, useDeleteProject, useNotes, useProject, useTasks, useUpdateProject, useUpdateTask } from '../lib/hooks'

type View = 'list' | 'board'

function readView(): View {
  try {
    return localStorage.getItem('projectView') === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

export default function ProjectPage({ tab }: { tab: 'tasks' | 'notes' }) {
  const id = Number(useParams().projectId)
  const { data: project, isLoading, error } = useProject(id)
  const [editing, setEditing] = useState(false)
  const [view, setViewState] = useState<View>(readView)
  const update = useUpdateProject()
  const remove = useDeleteProject()
  const navigate = useNavigate()

  function setView(v: View) {
    setViewState(v)
    try {
      localStorage.setItem('projectView', v)
    } catch {
      // not remembered, that's fine
    }
  }

  if (isLoading) return <Page><Spinner /></Page>
  if (error || !project) return <Page><ErrorBox error={error ?? 'Proje bulunamadı'} /></Page>

  const total = project.open_tasks + project.done_tasks
  const pct = total ? Math.round((project.done_tasks / total) * 100) : 0
  const archived = project.status === 'archived'

  async function deleteProject() {
    if (!confirm(`"${project!.name}" projesi, tüm görevleri ve notlarıyla birlikte silinsin mi? Bu işlem geri alınamaz.`)) return
    await remove.mutateAsync(id)
    navigate('/today')
  }

  const board = tab === 'tasks' && view === 'board'

  return (
    <Page width={board ? 'wide' : 'narrow'}>
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
            { to: `/projects/${id}`, label: 'Görevler', icon: <ListTodo className="size-4" /> },
            { to: `/projects/${id}/notes`, label: 'Notlar', icon: <NotebookPen className="size-4" /> },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isActive ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-fg-muted hover:text-fg'
                }`
              }
            >
              {t.icon}
              {t.label}
            </NavLink>
          ))}
        </div>
        {tab === 'tasks' && (
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: <><List className="size-3.5" /> Liste</> },
              { value: 'board', label: <><Columns3 className="size-3.5" /> Pano</> },
            ]}
          />
        )}
      </div>

      {tab === 'notes' ? (
        <ProjectNotes project={project} />
      ) : board ? (
        <ProjectBoard projectId={id} />
      ) : (
        <ProjectTasks projectId={id} />
      )}

      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} />}
    </Page>
  )
}

const STATUS_ICONS: Record<TaskStatus, ReactNode> = {
  todo: <Circle className="size-3.5 text-fg-faint" />,
  doing: <LoaderCircle className="size-3.5 text-amber-500" />,
  done: <CheckCircle2 className="size-3.5 text-emerald-500" />,
}

function ProjectBoard({ projectId }: { projectId: number }) {
  const { data, isLoading, error } = useTasks({ project_id: projectId })
  const update = useUpdateTask()
  // Columns already show the status, so only priority and tag filters apply here.
  const filter = useTaskFilters(['project', 'status'])
  const { apply, defaults } = filter

  const columns = useMemo<BoardColumn[]>(
    () =>
      (['todo', 'doing', 'done'] as TaskStatus[]).map((status) => ({
        id: status,
        title: STATUS_LABELS[status],
        icon: STATUS_ICONS[status],
        tasks: apply(data ?? []).filter((t) => t.status === status).sort((a, b) => a.sort_order - b.sort_order),
        quickAdd: status === 'done' ? undefined : { ...defaults, project_id: projectId, status },
      })),
    [data, projectId, apply, defaults],
  )

  function onMove({ task, columnId, before, after, changedColumn }: BoardMove) {
    update.mutate({
      id: task.id,
      patch: {
        sort_order: sortOrderBetween(before, after, task.sort_order),
        ...(changedColumn ? { status: columnId as TaskStatus } : {}),
      },
    })
  }

  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  return (
    <>
      <FilterBar state={filter} shown={apply(data ?? []).length} total={data?.length} />
      <Board columns={columns} onMove={onMove} showProject={false} showStatus={false} columnClassName="w-80" />
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
        <TaskList tasks={tasks} showProject={false} emptyText={filter.active ? 'Filtreye uyan açık görev yok' : 'Açık görev yok'} />
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
