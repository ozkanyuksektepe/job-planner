import { Inbox } from 'lucide-react'
import FilterBar from '../components/FilterBar'
import QuickAdd from '../components/QuickAdd'
import TaskList from '../components/TaskList'
import { EmptyState, ErrorBox, PageHeader, Spinner, Page } from '../components/ui'
import { useTaskFilters } from '../lib/filters'
import { useTasks } from '../lib/hooks'

export default function InboxPage() {
  const { data, isLoading, error } = useTasks({ inbox: true })
  const filter = useTaskFilters(['project'])
  const tasks = filter.apply(data ?? [])

  return (
    <Page>
      <PageHeader eyebrow="Yakala, sonra planla" title="Gelen Kutusu" subtitle="Henüz bir projeye atanmamış işler. Proje panolarında da Planlanmamış sütununda görünürler." />
      <QuickAdd defaults={filter.defaults} placeholder="Aklına geleni yaz…" />
      <FilterBar state={filter} shown={tasks.length} total={data?.length} />

      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {data &&
        (data.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="Gelen kutusu boş"
            hint="Aklına gelen her şeyi buraya hızlıca yaz; sonra bir projeye taşı ya da bir panonun alanına sürükle."
          />
        ) : (
          <TaskList tasks={tasks} emptyText={filter.active ? 'Filtreye uyan görev yok' : 'Bekleyen iş yok'} />
        ))}
    </Page>
  )
}
