// Dates are exchanged with the API as local "YYYY-MM-DD" strings.

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Local calendar day of an API timestamp (UTC ISO 8601). */
export function localDateOf(ts: string): string {
  return toISODate(new Date(ts))
}

/**
 * The day a task belongs to in the week view: scheduled date, else due date, else the day it was created.
 * Mirrors taskDaySQL in the backend.
 */
export function taskDay(t: { scheduled_date: string | null; due_date: string | null; created_at: string }): string {
  return t.scheduled_date ?? t.due_date ?? localDateOf(t.created_at)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

const longFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })
const shortYearFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "15 Ekim Perşembe" */
export function formatLong(iso: string): string {
  return longFmt.format(parseISODate(iso))
}

/** "Bugün", "Yarın", "Dün" or "15 Eki" */
export function formatRelative(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Bugün'
  if (iso === addDays(today, 1)) return 'Yarın'
  if (iso === addDays(today, -1)) return 'Dün'
  const d = parseISODate(iso)
  return d.getFullYear() === new Date().getFullYear() ? shortFmt.format(d) : shortYearFmt.format(d)
}

/** "0:42", "12:05" or "1:02:05" for a length in milliseconds. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Formats an API timestamp (UTC, ISO 8601) in local time. */
export function formatTimestamp(ts: string): string {
  return dateTimeFmt.format(new Date(ts))
}
