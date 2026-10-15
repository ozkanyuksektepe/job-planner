import { ArrowUpLeft, Calendar, CircleDot, Flag, FolderClosed, Hash, Signal, Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Task, TaskPatch, TaskStatus } from '../lib/api'
import { addDays, formatTimestamp, todayISO } from '../lib/dates'
import { useDeleteTask, useProjects, useTask, useTasks, useUpdateTask } from '../lib/hooks'
import { useTaskPanel } from '../lib/useTaskPanel'
import QuickAdd from './QuickAdd'
import TaskAttachments from './TaskAttachments'
import VoiceRecordings from './VoiceRecordings'
import TagPicker from './TagPicker'
import { TaskCheckbox } from './TaskItem'
import { Button, ColorDot, CountPill, ErrorBox, PRIORITY_DOTS, PRIORITY_LABELS, Segmented, Spinner, STATUS_LABELS } from './ui'

/** Floating right-hand panel for viewing and editing one task. */
export default function TaskDetail({ taskId }: { taskId: number }) {
  const { close } = useTaskPanel()
  const { data: task, isLoading, error } = useTask(taskId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <>
      <div className="fixed inset-0 z-30 animate-fade-in bg-zinc-950/10 backdrop-blur-[1px] dark:bg-black/40" onClick={close} />
      <aside className="fixed inset-y-2 right-2 z-40 flex w-[min(460px,calc(100%-16px))] animate-slide-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/10">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
            {task?.project_name ? (
              <>
                <ColorDot color={task.project_color} className="size-2" />
                <span className="truncate">{task.project_name}</span>
              </>
            ) : (
              <span>Görev</span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={close} title="Kapat (Esc)" className="-mr-1.5">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && <Spinner />}
          {error && <ErrorBox error={error} />}
          {task && <TaskForm task={task} />}
        </div>
      </aside>
    </>
  )
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[124px_1fr] items-center gap-2">
      <span className="flex items-center gap-2 text-xs text-fg-muted">
        <span className="text-fg-faint">{icon}</span>
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>
  )
}

const inputCls =
  'h-8 rounded-lg border border-transparent bg-transparent px-2 text-[13px] text-fg outline-none transition-colors hover:bg-hover focus:border-accent/50 focus:bg-surface'
const linkBtn = 'h-7 rounded-md px-2 text-xs text-fg-muted transition-colors hover:bg-hover hover:text-fg'

function TaskForm({ task }: { task: Task }) {
  const { open, close } = useTaskPanel()
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const { data: projects = [] } = useProjects()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const today = todayISO()
  const isSubtask = task.parent_id !== null

  const save = (patch: TaskPatch) => update.mutate({ id: task.id, patch })

  function saveTitle() {
    const t = title.trim()
    if (!t) return setTitle(task.title)
    if (t !== task.title) save({ title: t })
  }

  async function deleteTask() {
    const extra = task.subtask_count > 0 ? ` (${task.subtask_count} alt görev de silinecek)` : ''
    if (!confirm(`"${task.title}" silinsin mi?${extra}`)) return
    await remove.mutateAsync(task.id)
    if (task.parent_id) open(task.parent_id)
    else close()
  }

  return (
    <div>
      {isSubtask && (
        <button
          type="button"
          onClick={() => open(task.parent_id!)}
          className="mb-3 inline-flex items-center gap-1 rounded-md bg-hover px-2 py-1 text-xs text-fg-muted transition-colors hover:text-accent-fg"
        >
          <ArrowUpLeft className="size-3.5" /> {task.parent_title}
        </button>
      )}

      <div className="mb-6 flex items-start gap-3">
        <div className="pt-[7px]">
          <TaskCheckbox task={task} />
        </div>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          rows={1}
          className={`field-sizing-content w-full resize-none bg-transparent text-xl font-semibold leading-snug tracking-tight outline-none ${
            task.status === 'done' ? 'text-fg-faint line-through' : ''
          }`}
        />
      </div>

      <div className="mb-6 space-y-0.5">
        <Field icon={<CircleDot className="size-3.5" />} label="Durum">
          <Segmented<TaskStatus>
            value={task.status}
            onChange={(status) => save({ status })}
            options={(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </Field>

        <Field icon={<Signal className="size-3.5" />} label="Öncelik">
          <Segmented<number>
            value={task.priority}
            onChange={(priority) => save({ priority })}
            options={PRIORITY_LABELS.map((label, p) => ({
              value: p,
              label: (
                <>
                  <span className={`size-1.5 rounded-full ${PRIORITY_DOTS[p]}`} />
                  {label}
                </>
              ),
            }))}
          />
        </Field>

        <Field icon={<Calendar className="size-3.5" />} label="Planlanan gün">
          <input
            type="date"
            value={task.scheduled_date ?? ''}
            onChange={(e) => save({ scheduled_date: e.target.value || null })}
            className={inputCls}
          />
          <button type="button" onClick={() => save({ scheduled_date: today })} className={linkBtn}>Bugün</button>
          <button type="button" onClick={() => save({ scheduled_date: addDays(today, 1) })} className={linkBtn}>Yarın</button>
        </Field>

        <Field icon={<Flag className="size-3.5" />} label="Son tarih">
          <input
            type="date"
            value={task.due_date ?? ''}
            onChange={(e) => save({ due_date: e.target.value || null })}
            className={inputCls}
          />
        </Field>

        <Field icon={<FolderClosed className="size-3.5" />} label="Proje">
          <select
            value={task.project_id ?? ''}
            disabled={isSubtask}
            onChange={(e) => save({ project_id: e.target.value ? Number(e.target.value) : null })}
            className={`${inputCls} min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:bg-transparent`}
            title={isSubtask ? 'Alt görevler üst görevin projesindedir' : undefined}
          >
            <option value="">Proje yok</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === 'archived' ? ' (arşiv)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field icon={<Hash className="size-3.5" />} label="Etiketler">
          <TagPicker value={task.tags} onChange={(tag_ids) => save({ tag_ids })} />
        </Field>
      </div>

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Açıklama</div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description !== task.description && save({ description })}
        placeholder="Detaylar, linkler, notlar…"
        rows={4}
        className="field-sizing-content mb-7 min-h-24 w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed outline-none transition-all placeholder:text-fg-faint focus:border-accent/50 focus:bg-surface focus:ring-4 focus:ring-accent/10"
      />

      <TaskAttachments taskId={task.id} />

      <div className="mb-7">
        <VoiceRecordings owner={{ type: 'task', id: task.id }} />
      </div>

      {!isSubtask && <Subtasks task={task} />}

      <div className="mt-8 flex items-center justify-between border-t border-line pt-4 text-[11px] text-fg-faint">
        <span>
          Oluşturuldu {formatTimestamp(task.created_at)}
          {task.completed_at && <> · Tamamlandı {formatTimestamp(task.completed_at)}</>}
        </span>
        <Button variant="danger" size="sm" onClick={deleteTask}>
          <Trash2 className="size-3.5" /> Sil
        </Button>
      </div>

      {update.error && <div className="mt-3"><ErrorBox error={update.error} /></div>}
    </div>
  )
}

function Subtasks({ task }: { task: Task }) {
  const { open } = useTaskPanel()
  const remove = useDeleteTask()
  const { data: subtasks = [] } = useTasks({ parent_id: task.id })
  const done = subtasks.filter((s) => s.status === 'done').length

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Alt görevler</span>
        {subtasks.length > 0 && <CountPill tone={done === subtasks.length ? 'accent' : 'default'}>{done}/{subtasks.length}</CountPill>}
      </div>
      {subtasks.length > 0 && (
        <div className="mb-1 h-1 overflow-hidden rounded-full bg-hover">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(done / subtasks.length) * 100}%` }} />
        </div>
      )}
      <div className="-mx-2">
        {subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-hover">
            <TaskCheckbox task={s} size="sm" />
            <button
              type="button"
              onClick={() => open(s.id)}
              className={`min-w-0 flex-1 truncate text-left text-sm ${s.status === 'done' ? 'text-fg-faint line-through' : ''}`}
            >
              {s.title}
            </button>
            <button
              type="button"
              onClick={() => remove.mutate(s.id)}
              className="rounded p-0.5 text-fg-faint opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
              title="Sil"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <QuickAdd compact defaults={{ parent_id: task.id }} placeholder="Alt görev ekle…" />
      </div>
    </div>
  )
}
