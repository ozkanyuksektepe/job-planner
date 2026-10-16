import type { AttachmentOwner } from '../lib/api'
import { useAttachments, useUploadAttachments } from '../lib/hooks'
import AudioPlayer from './AudioPlayer'
import { CountPill, ErrorBox } from './ui'
import VoiceRecorder from './VoiceRecorder'
import { deleteWithUndo } from '../lib/undo'

/** "Ses kayıtları" section for a task or a note: the recordings' players plus the recorder. */
export default function VoiceRecordings({ owner }: { owner: AttachmentOwner }) {
  const { data = [] } = useAttachments(owner)
  const recordings = data.filter((a) => a.kind === 'audio')
  const upload = useUploadAttachments()
  const { mutate: save } = upload

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Ses kayıtları</span>
        {recordings.length > 0 && <CountPill>{recordings.length}</CountPill>}
      </div>
      <div className="space-y-2">
        {recordings.map((a) => (
          <AudioPlayer
            key={a.id}
            attachment={a}
            onDelete={() => deleteWithUndo({ kind: 'attachment', id: a.id, endpoint: `/attachments/${a.id}`, message: 'Ses kaydı silindi' })}
          />
        ))}
        <VoiceRecorder
          saving={upload.isPending}
          onRecorded={(file, durationMs) => save({ owner, files: [file], durationMs })}
        />
      </div>
      {upload.error && <div className="mt-2"><ErrorBox error={upload.error} /></div>}
    </div>
  )
}
