import { CheckCircle2, Circle, PartyPopper, Sun } from 'lucide-react'
import CollapsiblePanel from '../components/CollapsiblePanel'
import FilterBar from '../components/FilterBar'
import QuickAdd from '../components/QuickAdd'
import TaskItem from '../components/TaskItem'
import TaskList from '../components/TaskList'
import { Button, EmptyState, ErrorBox, PageHeader, ProgressRing, Section, Spinner, Page } from '../components/ui'
import { formatLong, todayISO } from '../lib/dates'
import { useTaskFilters } from '../lib/filters'
import { useToday, useUpdateTask } from '../lib/hooks'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

export default function TodayPage() {
  const date = todayISO()
  const { data, isLoading, error } = useToday(date)
  const update = useUpdateTask()
  const filter = useTaskFilters()
  const overdue = filter.apply(data?.overdue ?? [])
  const todayTasks = filter.apply(data?.today ?? [])

  function moveOverdueToToday() {
    for (const t of overdue) {
      update.mutate({ id: t.id, patch: { scheduled_date: date } })
    }
  }

  const total = data?.today.length ?? 0
  const done = data?.today.filter((t) => t.status === 'done').length ?? 0
  const open = total - done
  const openToday = todayTasks.filter((t) => t.status !== 'done')
  // Most recently completed first.
  const doneToday = todayTasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))

  return (
    <Page width="wide">
      <PageHeader
        eyebrow={formatLong(date)}
        title={greeting()}
        subtitle={
          data &&
          (open === 0 && total > 0
            ? 'Bugünkü her şey tamam. Harika iş! 🎉'
            : `Bugün ${open} açık görevin var${data.overdue.length ? `, ${data.overdue.length} tanesi gecikmiş` : ''}.`)
        }
        actions={
          total > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 py-2 pl-2 pr-4">
              <ProgressRing value={done / total} />
              <div className="leading-tight">
                <div className="text-sm font-semibold tabular-nums">
                  {done}/{total}
                </div>
                <div className="text-[11px] text-fg-muted">tamamlandı</div>
              </div>
            </div>
          )
        }
      />
      <QuickAdd defaults={{ ...filter.defaults, scheduled_date: date }} placeholder="Bugün için görev ekle…" />
      <FilterBar
        state={filter}
        shown={overdue.length + todayTasks.length}
        total={(data?.overdue.length ?? 0) + (data?.today.length ?? 0)}
      />

      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <CollapsiblePanel storageKey="today.open" title="Açık görevler" icon={<Circle className="size-4 text-fg-faint" />} count={overdue.length + openToday.length}>
            {overdue.length > 0 && (
              <Section
                title="Gecikmiş"
                count={overdue.length}
                tone="danger"
                actions={
                  <Button variant="ghost" size="sm" onClick={moveOverdueToToday}>
                    Hepsini bugüne al
                  </Button>
                }
              >
                <TaskList tasks={overdue} />
              </Section>
            )}
            <Section title="Bugün" count={openToday.length}>
              {total === 0 ? (
                <EmptyState
                  icon={<Sun className="size-6" />}
                  title="Bugün için planlanmış iş yok"
                  hint="Yukarıdan ekleyebilir ya da herhangi bir görevin üzerindeki ☀ ile bugüne alabilirsin."
                />
              ) : openToday.length === 0 ? (
                <p className="px-3 py-3 text-sm text-fg-muted">
                  {filter.active ? 'Filtreye uyan açık görev yok' : 'Açık görev kalmadı'}
                </p>
              ) : (
                // Left room for the drag handle that appears beside each row.
                <div className="pl-4">
                  <TaskList tasks={openToday} sortable />
                </div>
              )}
            </Section>
          </CollapsiblePanel>

          <CollapsiblePanel
            storageKey="today.done"
            title="Tamamlananlar"
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
            count={doneToday.length}
            tone="accent"
          >
            {doneToday.length === 0 ? (
              <EmptyState
                icon={<PartyPopper className="size-6" />}
                title="Henüz tamamlanan yok"
                hint="Bugün bitirdiğin görevler burada birikir."
              />
            ) : (
              <div className="mb-2 flex flex-col gap-px">
                {doneToday.map((t) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </div>
            )}
          </CollapsiblePanel>
        </div>
      )}
    </Page>
  )
}
