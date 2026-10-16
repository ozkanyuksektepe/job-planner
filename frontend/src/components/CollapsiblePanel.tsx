import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CountPill } from './ui'

/** Remembers whether a panel is collapsed (per panel, in localStorage). */
function useCollapsed(key: string): [boolean, () => void] {
  const storageKey = `collapsed.${key}`
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(storageKey, c ? '0' : '1')
      } catch {
        // not remembered, that's fine
      }
      return !c
    })
  }
  return [collapsed, toggle]
}

/** A bordered column (e.g. open vs. completed tasks) that folds down to its header; remembers its state. */
export default function CollapsiblePanel({ storageKey, title, icon, count, tone = 'default', children }: {
  /** localStorage key part, e.g. "today.open" */
  storageKey: string
  title: string
  icon: ReactNode
  count: number
  tone?: 'default' | 'accent'
  children: ReactNode
}) {
  const [collapsed, toggle] = useCollapsed(storageKey)
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className={`flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-hover ${
          collapsed ? 'rounded-2xl' : 'rounded-t-2xl'
        }`}
      >
        {icon}
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        <CountPill tone={tone}>{count}</CountPill>
        <ChevronDown className={`ml-auto size-4 text-fg-faint transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>
      {!collapsed && <div className="animate-fade-in border-t border-line p-2 pt-4 [&>section:last-child]:mb-2">{children}</div>}
    </section>
  )
}
