import { ChevronLeft, ChevronRight, History } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Board, { sortOrderBetween, type BoardColumn, type BoardMove } from '../components/Board'
import FilterBar from '../components/FilterBar'
import { Button, ErrorBox, Page, PageHeader, Spinner } from '../components/ui'
import { addDays, parseISODate, taskDay, todayISO } from '../lib/dates'
import { useTaskFilters } from '../lib/filters'
import { useTasks, useUpdateTask } from '../lib/hooks'

const BACKLOG = 'backlog'

const weekdayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' })
const dayMonthFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long' })
const yearFmt = new Intl.DateTimeFormat('tr-TR', { year: 'numeric' })

/** Monday of the week containing iso. */
function startOfWeek(iso: string): string {
  const offset = (parseISODate(iso).getDay() + 6) % 7
  return addDays(iso, -offset)
}

/** "13 – 19 Ekim" or "29 Eyl – 5 Eki" when the week spans two months. */
function weekTitle(start: string, end: string): string {
  const a = parseISODate(start)
  const b = parseISODate(end)
  if (a.getMonth() === b.getMonth()) return `${dayFmt.format(a)} – ${dayFmt.format(b)} ${monthFmt.format(b)}`
  return `${dayMonthFmt.format(a)} – ${dayMonthFmt.format(b)}`
}

export default function WeekPage() {
  const today = todayISO()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEnd = days[6]

  const week = useTasks({ from: weekStart, to: weekEnd })
  const backlog = useTasks({ backlog_before: weekStart })
  const update = useUpdateTask()
  const filter = useTaskFilters()
  const { apply, defaults } = filter

  const columns = useMemo<BoardColumn[]>(() => {
    const weekTasks = apply(week.data ?? [])
    return [
      {
        id: BACKLOG,
        title: 'Bekleyenler',
        subtitle: 'Önceki haftalardan kalan açık işler',
        icon: <History className="size-3.5 text-fg-faint" />,
        pinned: true,
        tasks: apply(backlog.data ?? []),
      },
      ...days.map((day) => {
        const d = parseISODate(day)
        const name = weekdayFmt.format(d)
        return {
          id: day,
          title: day === today ? `Bugün · ${name}` : name.charAt(0).toLocaleUpperCase('tr-TR') + name.slice(1),
          subtitle: dayMonthFmt.format(d),
          highlight: day === today,
          tasks: weekTasks
            .filter((t) => taskDay(t) === day)
            .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.sort_order - b.sort_order),
          quickAdd: { ...defaults, scheduled_date: day },
        }
      }),
    ]
  }, [week.data, backlog.data, days, today, apply, defaults])

  // Scroll the board sideways so today's column is fully visible. Only the board's own
  // horizontal scroll moves; scrollIntoView would also scroll the page down to a tall column.
  useEffect(() => {
    const column = document.querySelector<HTMLElement>(`[data-column="${today}"]`)
    const scroller = column?.closest<HTMLElement>('[data-board-scroller]')
    if (!column || !scroller) return
    const overflow = column.getBoundingClientRect().right - scroller.getBoundingClientRect().right
    if (overflow > 0) scroller.scrollLeft += overflow + 40 // 40px = the scroller's right padding
  }, [weekStart, today, week.isSuccess, backlog.isSuccess])

  function onMove({ task, columnId, before, after, changedColumn }: BoardMove) {
    update.mutate({
      id: task.id,
      patch: {
        sort_order: sortOrderBetween(before, after, task.sort_order),
        ...(changedColumn ? { scheduled_date: columnId === BACKLOG ? null : columnId } : {}),
      },
    })
  }

  const isCurrentWeek = weekStart === startOfWeek(today)
  const total = week.data?.filter((t) => t.status !== 'done').length ?? 0

  return (
    <Page width="full">
      <PageHeader
        eyebrow={`Haftalık plan · ${yearFmt.format(parseISODate(weekStart))}`}
        title={weekTitle(weekStart, weekEnd)}
        subtitle={week.data && `Bu hafta ${total} açık görev var. Görevler açıldıkları ya da planlandıkları günde görünür; sürükleyerek başka güne taşıyabilirsin.`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} title="Önceki hafta">
              <ChevronLeft className="size-4" />
            </Button>
            <Button onClick={() => setWeekStart(startOfWeek(today))} disabled={isCurrentWeek}>
              Bu hafta
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} title="Sonraki hafta">
              <ChevronRight className="size-4" />
            </Button>
          </>
        }
      />

      <FilterBar
        state={filter}
        shown={apply(week.data ?? []).length + apply(backlog.data ?? []).length}
        total={(week.data?.length ?? 0) + (backlog.data?.length ?? 0)}
      />
      {(week.isLoading || backlog.isLoading) && <Spinner />}
      {week.error && <ErrorBox error={week.error} />}
      {week.data && backlog.data && <Board columns={columns} onMove={onMove} columnClassName="w-60" showSchedule={false} />}
    </Page>
  )
}
