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

/** Formats an API timestamp (UTC, ISO 8601) in local time. */
export function formatTimestamp(ts: string): string {
  return dateTimeFmt.format(new Date(ts))
}
