import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const PROJECT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b']

export const PRIORITY_LABELS = ['Yok', 'Düşük', 'Orta', 'Yüksek']
export const PRIORITY_DOTS = ['bg-zinc-300 dark:bg-zinc-600', 'bg-sky-500', 'bg-orange-500', 'bg-rose-500']

export const STATUS_LABELS = { todo: 'Yapılacak', doing: 'Devam ediyor', done: 'Tamamlandı' } as const

export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-fg-faint">{eyebrow}</div>}
        <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}

export function Section({ title, count, tone = 'default', actions, children }: {
  title: string
  count?: number
  tone?: 'default' | 'danger'
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-1 flex items-center justify-between px-3">
        <h2
          className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${
            tone === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-fg-faint'
          }`}
        >
          {title}
          {count !== undefined && <CountPill tone={tone}>{count}</CountPill>}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function CountPill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'danger' | 'accent' }) {
  const styles = {
    default: 'bg-hover text-fg-muted',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    accent: 'bg-accent-soft text-accent-fg',
  }[tone]
  return (
    <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums tracking-normal ${styles}`}>
      {children}
    </span>
  )
}

/** Small rounded label used for task / note metadata. */
export function Chip({ icon, children, tone = 'default', className = '' }: {
  icon?: ReactNode
  children: ReactNode
  tone?: 'default' | 'danger' | 'warning' | 'orange' | 'info' | 'accent'
  className?: string
}) {
  const styles = {
    default: 'bg-hover text-fg-muted',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
    orange: 'bg-orange-500/12 text-orange-700 dark:text-orange-400',
    info: 'bg-sky-500/12 text-sky-700 dark:text-sky-400',
    accent: 'bg-accent-soft text-accent-fg',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ${styles} ${className}`}>
      {icon}
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-hover text-fg-faint">{icon}</div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs leading-relaxed text-fg-muted">{hint}</p>}
    </div>
  )
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'icon'
}) {
  const styles = {
    primary: 'bg-accent text-white shadow-sm shadow-accent/25 hover:bg-accent-hover disabled:opacity-50',
    secondary: 'border border-line bg-surface text-fg shadow-xs hover:bg-hover',
    ghost: 'text-fg-muted hover:bg-hover hover:text-fg',
    danger: 'text-fg-muted hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400',
  }[variant]
  const sizes = { sm: 'h-7 px-2 text-xs', md: 'h-8 px-3 text-sm', icon: 'size-8 justify-center' }[size]
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${styles} ${sizes} ${className}`}
      {...props}
    />
  )
}

export function ColorDot({ color, className = '' }: { color: string | null | undefined; className?: string }) {
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${className}`} style={{ backgroundColor: color ?? '#a1a1aa' }} />
}

/** Circular progress indicator (0..1). */
export function ProgressRing({ value, size = 36, stroke = 3.5, color = 'var(--accent)' }: {
  value: number
  size?: number
  stroke?: number
  color?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  )
}

export function Spinner() {
  return (
    <div className="space-y-2 px-3 py-4">
      {[70, 55, 80].map((w, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3">
          <div className="size-[18px] rounded-full bg-hover" />
          <div className="h-3.5 rounded bg-hover" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300">
      Bir hata oluştu: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

/** Pill-style segmented control. */
export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg bg-hover p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            value === o.value ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
