import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Task } from '../lib/api'
import TaskItem from './TaskItem'
import { CountPill } from './ui'

/** Shows open tasks, with completed ones folded away underneath. */
export default function TaskList({ tasks, showProject = true, emptyText }: {
  tasks: Task[]
  showProject?: boolean
  emptyText?: string
}) {
  const [showDone, setShowDone] = useState(false)
  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div>
      <div className="flex flex-col gap-px">
        {open.map((t) => (
          <TaskItem key={t.id} task={t} showProject={showProject} />
        ))}
      </div>
      {open.length === 0 && emptyText && <p className="px-3 py-3 text-sm text-fg-muted">{emptyText}</p>}

      {done.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-fg-faint transition-colors hover:bg-hover hover:text-fg-muted"
          >
            <ChevronRight className={`size-3.5 transition-transform ${showDone ? 'rotate-90' : ''}`} />
            Tamamlananlar
            <CountPill>{done.length}</CountPill>
          </button>
          {showDone && (
            <div className="mt-1 flex animate-fade-in flex-col gap-px">
              {done.map((t) => (
                <TaskItem key={t.id} task={t} showProject={showProject} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
