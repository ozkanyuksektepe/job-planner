import { Download, Pause, Play, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Attachment } from '../lib/api'
import { formatDuration, formatTimestamp } from '../lib/dates'

const RATES = [0.75, 1, 1.25, 1.5, 2]
const RATE_KEY = 'audioRate'
// Starting one player pauses the others.
const PLAY_EVENT = 'jobplanner:audio-play'

function readRate(): number {
  try {
    const r = Number(localStorage.getItem(RATE_KEY))
    return RATES.includes(r) ? r : 1
  } catch {
    return 1
  }
}

const label = (a: Attachment) => a.filename.replace(/\.[a-z0-9]+$/i, '')

/** Player for a recorded attachment: play / pause, seek, ±10 s, playback speed, download, delete. */
export default function AudioPlayer({ attachment, onDelete }: { attachment: Attachment; onDelete: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(attachment.duration_ms ? attachment.duration_ms / 1000 : 0)
  const [rate, setRate] = useState(readRate)
  const probing = useRef(false)

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])

  useEffect(() => {
    const onOtherPlay = (e: Event) => {
      if ((e as CustomEvent<number>).detail !== attachment.id) audioRef.current?.pause()
    }
    window.addEventListener(PLAY_EVENT, onOtherPlay)
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay)
  }, [attachment.id])

  function onLoadedMetadata() {
    const el = audioRef.current!
    el.playbackRate = rate
    if (Number.isFinite(el.duration)) {
      if (!attachment.duration_ms) setDuration(el.duration)
    } else if (!attachment.duration_ms) {
      // Browser-recorded WebM has no duration header; seeking to the end makes the browser compute it.
      probing.current = true
      el.currentTime = 1e101
    }
  }

  function onTimeUpdate() {
    const el = audioRef.current!
    if (probing.current) {
      probing.current = false
      if (Number.isFinite(el.duration)) setDuration(el.duration)
      el.currentTime = 0
      return
    }
    setTime(el.currentTime)
  }

  function toggle() {
    const el = audioRef.current!
    if (el.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: attachment.id }))
      el.play()
    } else {
      el.pause()
    }
  }

  function seek(to: number) {
    const el = audioRef.current!
    const max = duration || el.duration || 0
    el.currentTime = Math.max(0, Math.min(Number.isFinite(max) && max > 0 ? max : to, to))
    setTime(el.currentTime)
  }

  function nextRate() {
    const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    setRate(r)
    try {
      localStorage.setItem(RATE_KEY, String(r))
    } catch {
      // not remembered, that's fine
    }
  }

  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0
  const iconBtn = 'flex size-7 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-hover hover:text-fg'

  return (
    <div className="group rounded-xl border border-line bg-surface-2 p-3">
      <audio
        ref={audioRef}
        src={attachment.url}
        preload="auto"
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={() => {
          const d = audioRef.current?.duration
          if (!attachment.duration_ms && d && Number.isFinite(d)) setDuration(d)
        }}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm shadow-accent/25 transition-colors hover:bg-accent-hover"
          title={playing ? 'Duraklat' : 'Oynat'}
        >
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium" title={attachment.filename}>
            {label(attachment)}
          </div>
          <div className="text-[11px] tabular-nums text-fg-faint">
            {formatDuration(time * 1000)} / {duration ? formatDuration(duration * 1000) : '–:––'} · {formatTimestamp(attachment.created_at)}
          </div>
        </div>
        <button
          type="button"
          onClick={nextRate}
          className={`h-7 min-w-11 rounded-lg px-1.5 text-xs font-semibold tabular-nums transition-colors ${
            rate !== 1 ? 'bg-accent-soft text-accent-fg' : 'text-fg-muted hover:bg-hover hover:text-fg'
          }`}
          title="Oynatma hızı"
        >
          {rate}x
        </button>
        <a href={attachment.url} download={attachment.filename} className={iconBtn} title="İndir">
          <Download className="size-3.5" />
        </a>
        <button type="button" onClick={onDelete} className={`${iconBtn} hover:!bg-rose-500/10 hover:!text-rose-500`} title="Kaydı sil">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button type="button" onClick={() => seek(time - 10)} className={iconBtn} title="10 sn geri">
          <RotateCcw className="size-3.5" />
        </button>
        <div className="relative flex h-4 flex-1 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!duration}
            aria-label="Kayıtta ilerle"
            className="relative h-4 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow"
          />
        </div>
        <button type="button" onClick={() => seek(time + 10)} className={iconBtn} title="10 sn ileri">
          <RotateCw className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
