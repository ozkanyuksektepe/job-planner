import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import NoteGrid from '../components/NoteGrid'
import { Button, ErrorBox, PageHeader, Spinner, Page } from '../components/ui'
import { useCreateNote, useNotes } from '../lib/hooks'

export default function NotesPage() {
  const { data, isLoading, error } = useNotes()
  const create = useCreateNote()
  const navigate = useNavigate()

  async function newNote() {
    const note = await create.mutateAsync({})
    navigate(`/notes/${note.id}`)
  }

  return (
    <Page>
      <PageHeader
        eyebrow={data ? `${data.length} not` : undefined}
        title="Notlar"
        subtitle="Tüm notların; projelere ait olanlar da burada."
        actions={
          <Button variant="primary" onClick={newNote} disabled={create.isPending}>
            <Plus className="size-4" /> Yeni not
          </Button>
        }
      />
      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {data && <NoteGrid notes={data} />}
    </Page>
  )
}
