import { Archive, ArchiveRestore, ListTodo, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import NoteGrid from '../components/NoteGrid'
import ProjectDialog from '../components/ProjectDialog'
import QuickAdd from '../components/QuickAdd'
import TaskList from '../components/TaskList'
import { Button, Chip, ErrorBox, Spinner } from '../components/ui'
import type { Project } from '../lib/api'
import { useCreateNote, useDeleteProject, useNotes, useProject, useTasks, useUpdateProject } from '../lib/hooks'

export default function ProjectPage({ tab }: { tab: 'tasks' | 'notes' }) {
  const id = Number(useParams().projectId)
  const { data: project, isLoading, error } = useProject(id)
  const [editing, setEditing] = useState(false)
  const update = useUpdateProject()
  const remove = useDeleteProject()
  const navigate = useNavigate()

  if (isLoading) return <Spinner />
  if (error || !project) return <ErrorBox error={error ?? 'Proje bulunamadı'} />

  const total = project.open_tasks + project.done_tasks
  const pct = total ? Math.round((project.done_tasks / total) * 100) : 0
  const archived = project.status === 'archived'

  async function deleteProject() {
    if (!confirm(`"${project!.name}" projesi, tüm görevleri ve notlarıyla birlikte silinsin mi? Bu işlem geri alınamaz.`)) return
    await remove.mutateAsync(id)
    navigate('/today')
  }

  return (
    <>
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

      <div className="mb-6 inline-flex rounded-xl bg-hover p-1">
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

      {tab === 'tasks' ? <ProjectTasks projectId={id} /> : <ProjectNotes project={project} />}

      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} />}
    </>
  )
}

function ProjectTasks({ projectId }: { projectId: number }) {
  const { data, isLoading, error } = useTasks({ project_id: projectId })
  return (
    <>
      <QuickAdd defaults={{ project_id: projectId }} placeholder="Projeye görev ekle…" />
      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {data && <TaskList tasks={data} showProject={false} emptyText="Açık görev yok" />}
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
