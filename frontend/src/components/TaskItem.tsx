import {
  AlignLeft, Calendar, Check, ChevronRight, Columns3, CornerDownRight, Inbox, Flag, Hash, ImageIcon, ListChecks, Loader, Mic, SignalHigh, SignalLow, SignalMedium, Sun,
} from 'lucide-react'
import { createContext, useContext, type ReactNode } from 'react'
import type { Task, TagRef } from '../lib/api'
import { formatRelative, todayISO } from '../lib/dates'
import { useUpdateTask } from '../lib/hooks'
import { useTaskPanel } from '../lib/useTaskPanel'
import { Chip, ColorDot, PRIORITY_LABELS } from './ui'

const PRIORITY_BADGE = [
  null,
  { tone: 'info', icon: SignalLow },
  { tone: 'orange', icon: SignalMedium },
  { tone: 'danger', icon: SignalHigh },
] as const

/** "Düşük / Orta / Yüksek" badge; nothing for tasks without a priority. */
export function PriorityBadge({ priority }: { priority: number }) {
  const badge = PRIORITY_BADGE[priority]
  if (!badge) return null
  const Icon = badge.icon
  return (
    <Chip tone={badge.tone} icon={<Icon className="size-3" strokeWidth={2.5} />}>
      {PRIORITY_LABELS[priority]}
    </Chip>
  )
}

export function TagChip({ tag, children }: { tag: TagRef; children?: ReactNode }) {
  return (
    <Chip icon={<Hash className="size-3" strokeWidth={2.5} style={{ color: tag.color }} />}>
      {tag.name}
      {children}
    </Chip>
  )
}

/** Metadata chips shared by list rows and board cards. */
export function taskMetaChips(
  task: Task,
  { showProject = true, showSchedule = true, showStatus = true, boardId, markInbox = false }: {
    showProject?: boolean
    showSchedule?: boolean
    showStatus?: boolean
    /** the board the task is shown on; its own chip would be redundant there */
    boardId?: number
    /** label tasks without a project (shown on a project's board, they come from the inbox) */
    markInbox?: boolean
  } = {},
): ReactNode[] {
  const today = todayISO()
  const done = task.status === 'done'
  const overdue = !done && task.due_date !== null && task.due_date < today
  return [
    showStatus && task.status === 'doing' && (
      <Chip key="doing" tone="warning" icon={<Loader className="size-3" />}>Devam ediyor</Chip>
    ),
    task.parent_title && (
      <Chip key="parent" icon={<CornerDownRight className="size-3" />}>{task.parent_title}</Chip>
    ),
    showSchedule && task.scheduled_date && task.scheduled_date !== today && (
      <Chip key="sched" icon={<Calendar className="size-3" />}>{formatRelative(task.scheduled_date)}</Chip>
    ),
    task.due_date && (
      <Chip key="due" tone={overdue ? 'danger' : 'default'} icon={<Flag className="size-3" />}>
        {formatRelative(task.due_date)}
      </Chip>
    ),
    task.description.trim() !== '' && (
      <Chip key="desc" icon={<AlignLeft className="size-3" />} title="Açıklaması var" />
    ),
    task.subtask_count > 0 && (
      <Chip key="sub" tone={task.subtask_done === task.subtask_count ? 'accent' : 'default'} icon={<ListChecks className="size-3" />}>
        {task.subtask_done}/{task.subtask_count}
      </Chip>
    ),
    task.image_count > 0 && (
      <Chip key="img" icon={<ImageIcon className="size-3" />}>{task.image_count}</Chip>
    ),
    task.audio_count > 0 && (
      <Chip key="audio" icon={<Mic className="size-3" />}>{task.audio_count}</Chip>
    ),
    markInbox && task.project_id === null && task.parent_id === null && (
      <Chip key="inbox" tone="info" icon={<Inbox className="size-3" />}>Gelen Kutusu</Chip>
    ),
    showProject && task.project_name && (
      <Chip key="proj" icon={<ColorDot color={task.project_color} className="size-1.5" />}>{task.project_name}</Chip>
    ),
    // Only open tasks in a column: "Planlanmamış" holds every open task, "Tamamlananlar" every done one.
    ...(done ? [] : task.boards)
      .filter((b) => b.column_id !== null && b.board_id !== boardId)
      .map((b) => (
        <Chip key={`board-${b.board_id}`} icon={<Columns3 className="size-3" />} title={`Pano: ${b.board_name} › ${b.column_name}`}>
          {b.board_name}
          <ChevronRight className="-mx-0.5 size-2.5 opacity-60" />
          {b.column_name}
        </Chip>
      )),
    ...task.tags.map((tag) => <TagChip key={`tag-${tag.id}`} tag={tag} />),
  ].filter(Boolean)
}

/**
 * Lets a page take over what checking a task does (e.g. a board also files it under "Tamamlananlar").
 * Without a provider the checkbox just toggles the status.
 */
export const TaskCompleteContext = createContext<((task: Task, done: boolean) => void) | null>(null)

export function TaskCheckbox({ task, size = 'md' }: { task: Task; size?: 'sm' | 'md' }) {
  const update = useUpdateTask()
  const onComplete = useContext(TaskCompleteContext)
  const done = task.status === 'done'
  const dim = size === 'sm' ? 'size-4' : 'size-[18px]'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (onComplete) onComplete(task, !done)
        else update.mutate({ id: task.id, patch: { status: done ? 'todo' : 'done' } })
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`group/check flex ${dim} shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all ${
        done ? 'animate-check border-accent bg-accent text-white' : 'border-zinc-300 hover:border-fg-faint dark:border-zinc-600'
      }`}
      title={done ? 'Tamamlanmadı olarak işaretle' : 'Tamamla'}
    >
      <Check
        className={`size-2.5 transition-opacity ${done ? 'opacity-100' : 'text-fg-faint opacity-0 group-hover/check:opacity-100'}`}
        strokeWidth={3.5}
      />
    </button>
  )
}

export default function TaskItem({ task, showProject = true }: { task: Task; showProject?: boolean }) {
  const { open, taskId } = useTaskPanel()
  const update = useUpdateTask()
  const today = todayISO()
  const done = task.status === 'done'
  const scheduledToday = task.scheduled_date === today
  const selected = taskId === task.id
  const meta = taskMetaChips(task, { showProject })

  return (
    <div
      onClick={() => open(task.id)}
      className={`group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        selected ? 'bg-accent-soft' : 'hover:bg-hover'
      }`}
    >
      <div className="pt-px">
        <TaskCheckbox task={task} />
      </div>

      <div className="min-w-0 flex-1">
        <div className={`text-sm leading-5 transition-colors ${done ? 'text-fg-faint line-through decoration-fg-faint/60' : 'text-fg'}`}>
          {task.title}
        </div>
        {meta.length > 0 && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!done && !scheduledToday && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              update.mutate({ id: task.id, patch: { scheduled_date: today } })
            }}
            className="flex size-6 items-center justify-center rounded-md text-fg-faint opacity-0 transition-all hover:bg-amber-500/10 hover:text-amber-500 group-hover:opacity-100"
            title="Bugüne planla"
          >
            <Sun className="size-4" />
          </button>
        )}
        {!done && <PriorityBadge priority={task.priority} />}
      </div>
    </div>
  )
}
