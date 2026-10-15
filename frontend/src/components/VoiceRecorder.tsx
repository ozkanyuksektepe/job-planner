import { Loader2, Mic, Pause, Play, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/dates'
import { Button } from './ui'

/** Recordings stop automatically at this length. */
const MAX_MS = 30 * 60 * 1000
const LEVEL_BARS = 28

// Chrome / Firefox record WebM (Opus), Safari records MP4 (AAC).
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function extensionFor(mime: string) {
  if (mime.includes('mp4')) return '.m4a'
  if (mime.includes('ogg')) return '.ogg'
  return '.webm'
}

function fileName(mime: string) {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Ses kaydı ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}${extensionFor(mime)}`
}

type Phase = 'idle' | 'starting' | 'recording' | 'paused'

interface Session {
  recorder: MediaRecorder
  stream: MediaStream
  audio: AudioContext
  chunks: Blob[]
  discard: boolean
  // Elapsed time excluding pauses: finished segments + the running one.
  doneMs: number
  segmentStart: number | null
}

/**
 * Records from the microphone with pause / resume and a live level meter.
 * Audio stays on this computer: it's recorded by the browser and uploaded to the local server.
 */
export default function VoiceRecorder({ onRecorded, saving }: {
  onRecorded: (file: File, durationMs: number) => void
  saving?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_BARS).fill(0))
  const [error, setError] = useState<string | null>(null)
  const session = useRef<Session | null>(null)
  const onRecordedRef = useRef(onRecorded)
  onRecordedRef.current = onRecorded

  const elapsedOf = (s: Session) => s.doneMs + (s.segmentStart !== null ? performance.now() - s.segmentStart : 0)

  // Timer, level meter and the length limit while recording.
  useEffect(() => {
    const s = session.current
    if (phase !== 'recording' || !s) return
    const analyser = s.audio.createAnalyser()
    analyser.fftSize = 512
    s.audio.createMediaStreamSource(s.stream).connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < 80) return
      last = now
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) sum += ((v - 128) / 128) ** 2
      const level = Math.min(1, Math.sqrt(sum / data.length) * 4)
      setLevels((prev) => [...prev.slice(1), level])
      const ms = elapsedOf(s)
      setElapsed(ms)
      if (ms >= MAX_MS) stop()
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      analyser.disconnect()
    }
  }, [phase])

  // Leaving the page mid-recording would lose it: ask first, and save if the component goes away.
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'paused') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase])
  useEffect(() => () => finish(false), [])

  async function start() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Bu tarayıcı ses kaydını desteklemiyor.')
      return
    }
    setPhase('starting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      setPhase('idle')
      setError('Mikrofona erişilemedi. Tarayıcının adres çubuğundaki izin ayarından mikrofona izin ver.')
      return
    }
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const s: Session = { recorder, stream, audio: new AudioContext(), chunks: [], discard: false, doneMs: 0, segmentStart: performance.now() }
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) s.chunks.push(e.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      s.audio.close()
      if (!s.discard && s.chunks.length > 0) {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        // finish() has already folded the running segment into doneMs.
        onRecordedRef.current(new File(s.chunks, fileName(type), { type }), s.doneMs)
      }
    }
    session.current = s
    recorder.start(1000)
    setElapsed(0)
    setLevels(Array(LEVEL_BARS).fill(0))
    setPhase('recording')
  }

  function pause() {
    const s = session.current
    if (!s || s.recorder.state !== 'recording') return
    s.recorder.pause()
    s.doneMs = elapsedOf(s)
    s.segmentStart = null
    setElapsed(s.doneMs)
    setPhase('paused')
  }

  function resume() {
    const s = session.current
    if (!s || s.recorder.state !== 'paused') return
    s.recorder.resume()
    s.segmentStart = performance.now()
    setPhase('recording')
  }

  /** Stops the recording; discard drops it instead of saving. */
  function finish(discard: boolean) {
    const s = session.current
    if (!s) return
    session.current = null
    s.doneMs = elapsedOf(s)
    s.segmentStart = null
    s.discard = discard
    if (s.recorder.state !== 'inactive') s.recorder.stop()
    setPhase('idle')
  }

  const stop = () => finish(false)

  if (phase === 'idle' || phase === 'starting') {
    return (
      <div>
        <button
          type="button"
          onClick={start}
          disabled={phase === 'starting' || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-3.5 text-xs text-fg-muted transition-colors hover:border-rose-400/60 hover:bg-rose-500/5 hover:text-rose-600 disabled:opacity-60 dark:hover:text-rose-400"
        >
          {saving || phase === 'starting' ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
          {saving ? 'Kayıt kaydediliyor…' : phase === 'starting' ? 'Mikrofon açılıyor…' : 'Ses kaydı başlat'}
        </button>
        {error && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    )
  }

  const recording = phase === 'recording'
  return (
    <div className="rounded-xl border border-rose-400/40 bg-rose-500/5 p-3">
      <div className="flex items-center gap-3">
        <span className="relative flex size-3 shrink-0">
          {recording && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/60" />}
          <span className={`relative size-3 rounded-full ${recording ? 'bg-rose-500' : 'bg-fg-faint'}`} />
        </span>
        <span className="w-14 font-mono text-sm tabular-nums text-fg">{formatDuration(elapsed)}</span>
        <div className="flex h-7 flex-1 items-center gap-[3px]" aria-hidden>
          {levels.map((l, i) => (
            <span
              key={i}
              className={`w-full rounded-full transition-[height] duration-75 ${recording ? 'bg-rose-500/70' : 'bg-fg-faint/40'}`}
              style={{ height: `${Math.max(8, l * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="danger" size="sm" onClick={() => finish(true)} title="Kaydı sil">
          <Trash2 className="size-3.5" /> Vazgeç
        </Button>
        <div className="flex items-center gap-2">
          {recording ? (
            <Button size="sm" onClick={pause}>
              <Pause className="size-3.5" /> Duraklat
            </Button>
          ) : (
            <Button size="sm" onClick={resume}>
              <Play className="size-3.5" /> Devam et
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={stop}>
            <Square className="size-3 fill-current" /> Bitir ve kaydet
          </Button>
        </div>
      </div>
      {!recording && <p className="mt-2 text-[11px] text-fg-muted">Kayıt duraklatıldı.</p>}
    </div>
  )
}
