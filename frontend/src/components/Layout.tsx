import { Archive, CalendarDays, ChevronRight, Hash, Inbox, Monitor, Moon, NotebookPen, Plus, Sun, SunMedium } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { todayISO } from '../lib/dates'
import { useProjects, useTags, useTasks, useToday } from '../lib/hooks'
import { useTheme, type ThemePref } from '../lib/theme'
import { useTaskPanel } from '../lib/useTaskPanel'
import ProjectDialog from './ProjectDialog'
import TaskDetail from './TaskDetail'
import { ColorDot } from './ui'
import { ConfirmHost } from './ConfirmDialog'
import Toaster from './Toaster'

function NavItem({ to, icon, badge, children, end }: {
  to: string
  icon: ReactNode
  badge?: number
  children: ReactNode
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors ${
          isActive
            ? 'bg-surface font-medium text-fg shadow-xs ring-1 ring-line'
            : 'text-fg-muted hover:bg-hover hover:text-fg'
        }`
      }
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {!!badge && <span className="text-[11px] font-medium tabular-nums text-fg-faint">{badge}</span>}
    </NavLink>
  )
}

function ThemeToggle() {
  const [pref, setPref] = useTheme()
  const options: { value: ThemePref; icon: ReactNode; label: string }[] = [
    { value: 'light', icon: <SunMedium className="size-3.5" />, label: 'Açık' },
    { value: 'dark', icon: <Moon className="size-3.5" />, label: 'Koyu' },
    { value: 'system', icon: <Monitor className="size-3.5" />, label: 'Sistem' },
  ]
  return (
    <div className="flex rounded-lg bg-hover p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setPref(o.value)}
          title={o.label}
          className={`flex h-6 flex-1 items-center justify-center rounded-md transition-all ${
            pref === o.value ? 'bg-surface text-fg shadow-xs ring-1 ring-line' : 'text-fg-faint hover:text-fg'
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const { data: projects = [] } = useProjects()
  const { data: today } = useToday(todayISO())
  const { data: inbox } = useTasks({ inbox: true })
  const { data: tags = [] } = useTags()
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const navigate = useNavigate()
  const { taskId } = useTaskPanel()

  const active = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')
  const todayOpen = (today?.today.filter((t) => t.status !== 'done').length ?? 0) + (today?.overdue.length ?? 0)
  const inboxOpen = inbox?.filter((t) => t.status !== 'done').length ?? 0

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col px-3 pb-3">
        <div className="flex items-center gap-2.5 px-2 pb-5 pt-5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">jobPlanner</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          <NavItem to="/today" icon={<Sun className="size-4" />} badge={todayOpen}>Bugün</NavItem>
          <NavItem to="/inbox" icon={<Inbox className="size-4" />} badge={inboxOpen}>Gelen Kutusu</NavItem>
          <NavItem to="/week" icon={<CalendarDays className="size-4" />}>Bu Hafta</NavItem>
          <NavItem to="/notes" icon={<NotebookPen className="size-4" />} end>Notlar</NavItem>
        </nav>

        <div className="mt-7 flex items-center justify-between px-2.5 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Projeler</span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex size-5 items-center justify-center rounded-md text-fg-faint transition-colors hover:bg-hover hover:text-fg"
            title="Yeni proje"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 pb-4">
          {active.map((p) => (
            <NavItem key={p.id} to={`/projects/${p.id}`} icon={<ColorDot color={p.color} className="size-2" />} badge={p.open_tasks}>
              {p.name}
            </NavItem>
          ))}
          {active.length === 0 && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-8 items-center gap-2.5 rounded-lg border border-dashed border-line px-2.5 text-[13px] text-fg-faint transition-colors hover:border-accent/40 hover:text-accent-fg"
            >
              <Plus className="size-4" /> İlk projeni oluştur
            </button>
          )}

          {archived.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="mt-3 flex items-center gap-1.5 px-2.5 py-1 text-xs text-fg-faint hover:text-fg-muted"
              >
                <ChevronRight className={`size-3 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                <Archive className="size-3" /> Arşiv ({archived.length})
              </button>
              {showArchived &&
                archived.map((p) => (
                  <NavItem key={p.id} to={`/projects/${p.id}`} icon={<ColorDot color={p.color} className="size-2 opacity-40" />}>
                    <span className="text-fg-faint">{p.name}</span>
                  </NavItem>
                ))}
            </>
          )}

          {tags.length > 0 && (
            <>
              <div className="mt-6 px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Etiketler</div>
              {tags.map((t) => (
                <NavItem
                  key={t.id}
                  to={`/tags/${t.id}`}
                  icon={<Hash className="size-3.5" strokeWidth={2.5} style={{ color: t.color }} />}
                  badge={t.open_tasks}
                >
                  {t.name}
                </NavItem>
              ))}
            </>
          )}
        </nav>

        <ThemeToggle />
      </aside>

      <main className="min-w-0 flex-1 py-2 pr-2">
        <div className="h-full overflow-y-auto rounded-2xl border border-line bg-surface shadow-sm">
          <Outlet />
        </div>
      </main>

      {taskId !== null && <TaskDetail key={taskId} taskId={taskId} />}
      <ConfirmHost />
      <Toaster />


      {creating && (
        <ProjectDialog
          onClose={() => setCreating(false)}
          onSaved={(p) => {
            setCreating(false)
            navigate(`/projects/${p.id}`)
          }}
        />
      )}
    </div>
  )
}
