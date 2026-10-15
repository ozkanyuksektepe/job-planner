import { Inbox } from 'lucide-react'
import QuickAdd from '../components/QuickAdd'
import TaskList from '../components/TaskList'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { useTasks } from '../lib/hooks'

export default function InboxPage() {
  const { data, isLoading, error } = useTasks({ inbox: true })

  return (
    <>
      <PageHeader eyebrow="Yakala, sonra planla" title="Gelen Kutusu" subtitle="Henüz bir projeye ya da güne atanmamış işler." />
      <QuickAdd placeholder="Aklına geleni yaz…" />

      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {data &&
        (data.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="Gelen kutusu boş"
            hint="Aklına gelen her şeyi buraya hızlıca yaz; sonra projeye taşı ya da bir güne planla."
          />
        ) : (
          <TaskList tasks={data} emptyText="Bekleyen iş yok" />
        ))}
    </>
  )
}
