import { Check, ChevronDown, CircleDot, FolderClosed, Hash, ListFilter, Signal, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TaskStatus } from '../lib/api'
import { NO_PROJECT, type FilterKey, type TaskFilterState } from '../lib/filters'
import { useProjects, useTags } from '../lib/hooks'
import { ColorDot, PRIORITY_DOTS, PRIORITY_LABELS, STATUS_LABELS } from './ui'

interface Option {
  value: string
  label: string
  icon?: ReactNode
}

/** Project / priority / status / tag filter chips for task lists and boards. */
export default function FilterBar({ state, shown, total }: {
  state: TaskFilterState
  /** visible vs. all task counts, shown while a filter is active */
  shown?: number
  total?: number
}) {
  const { filters, toggle, clear, active, hidden } = state
  const { data: projects = [] } = useProjects()
  const { data: tags = [] } = useTags()
  const show = (k: FilterKey) => !hidden.includes(k)

  const projectOptions: Option[] = [
    ...projects.map((p) => ({ value: String(p.id), label: p.name, icon: <ColorDot color={p.color} className="size-2" /> })),
    { value: NO_PROJECT, label: 'Proje yok', icon: <span className="size-2 rounded-full border border-fg-faint" /> },
  ]
  const priorityOptions: Option[] = [3, 2, 1, 0].map((p) => ({
    value: String(p),
    label: PRIORITY_LABELS[p],
    icon: <span className={`size-2 rounded-full ${PRIORITY_DOTS[p]}`} />,
  }))
  const statusOptions: Option[] = (Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))
  const tagOptions: Option[] = tags.map((t) => ({
    value: String(t.id),
    label: t.name,
    icon: <Hash className="size-3" strokeWidth={2.5} style={{ color: t.color }} />,
  }))

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <ListFilter className="size-4 text-fg-faint" />
      {show('project') && (
        <FilterMenu label="Proje" icon={FolderClosed} options={projectOptions} selected={filters.project} onToggle={(v) => toggle('project', v)} />
      )}
      {show('priority') && (
        <FilterMenu label="Öncelik" icon={Signal} options={priorityOptions} selected={filters.priority} onToggle={(v) => toggle('priority', v)} />
      )}
      {show('status') && (
        <FilterMenu label="Durum" icon={CircleDot} options={statusOptions} selected={filters.status} onToggle={(v) => toggle('status', v)} />
      )}
      {show('tag') && (
        <FilterMenu
          label="Etiket"
          icon={Hash}
          options={tagOptions}
          selected={filters.tag}
          onToggle={(v) => toggle('tag', v)}
          empty="Henüz etiket yok"
        />
      )}
      {active > 0 && (
        <>
          <button
            type="button"
            onClick={clear}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <X className="size-3.5" /> Temizle
          </button>
          {shown !== undefined && total !== undefined && (
            <span className="ml-auto text-xs tabular-nums text-fg-faint">
              {total} görevden {shown} tanesi gösteriliyor
            </span>
          )}
        </>
      )}
    </div>
  )
}

function FilterMenu({ label, icon: Icon, options, selected, onToggle, empty }: {
  label: string
  icon: LucideIcon
  options: Option[]
  selected: string[]
  onToggle: (value: string) => void
  empty?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const activeLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label)
  const isActive = activeLabels.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
          isActive
            ? 'border-accent/40 bg-accent-soft text-accent-fg'
            : 'border-line bg-surface text-fg-muted hover:bg-hover hover:text-fg'
        }`}
      >
        <Icon className="size-3.5" />
        <span className="max-w-44 truncate">
          {label}
          {isActive && (
            <span className="font-semibold">: {activeLabels.length === 1 ? activeLabels[0] : `${activeLabels.length} seçili`}</span>
          )}
        </span>
        <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 animate-pop overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl shadow-black/10">
          <div className="max-h-64 overflow-y-auto">
            {options.map((o) => {
              const checked = selected.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onToggle(o.value)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-hover"
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked ? 'border-accent bg-accent text-white' : 'border-line'
                    }`}
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {o.icon && <span className="flex w-3 justify-center">{o.icon}</span>}
                  <span className="flex-1 truncate">{o.label}</span>
                </button>
              )
            })}
            {options.length === 0 && <p className="px-2 py-2 text-xs text-fg-faint">{empty ?? 'Seçenek yok'}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
