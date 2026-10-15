import { Sun } from 'lucide-react'
import QuickAdd from '../components/QuickAdd'
import TaskList from '../components/TaskList'
import { Button, EmptyState, ErrorBox, PageHeader, ProgressRing, Section, Spinner } from '../components/ui'
import { formatLong, todayISO } from '../lib/dates'
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

  function moveOverdueToToday() {
    for (const t of data?.overdue ?? []) {
      update.mutate({ id: t.id, patch: { scheduled_date: date } })
    }
  }

  const total = data?.today.length ?? 0
  const done = data?.today.filter((t) => t.status === 'done').length ?? 0
  const open = total - done

  return (
    <>
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
      <QuickAdd defaults={{ scheduled_date: date }} placeholder="Bugün için görev ekle…" />

      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}

      {data && data.overdue.length > 0 && (
        <Section
          title="Gecikmiş"
          count={data.overdue.length}
          tone="danger"
          actions={
            <Button variant="ghost" size="sm" onClick={moveOverdueToToday}>
              Hepsini bugüne al
            </Button>
          }
        >
          <TaskList tasks={data.overdue} />
        </Section>
      )}

      {data && (
        <Section title="Bugün" count={open}>
          {total === 0 ? (
            <EmptyState
              icon={<Sun className="size-6" />}
              title="Bugün için planlanmış iş yok"
              hint="Yukarıdan ekleyebilir ya da herhangi bir görevin üzerindeki ☀ ile bugüne alabilirsin."
            />
          ) : (
            <TaskList tasks={data.today} emptyText="Açık görev kalmadı" />
          )}
        </Section>
      )}
    </>
  )
}
