import { usePlayer } from '../player/PlayerContext'

function formatTime(s: number) {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const w = parts[0] ?? '?'
  return w.slice(0, 2).toUpperCase()
}

export function PlayerBar() {
  const p = usePlayer()
  if (!p.currentTrack && p.queue.length === 0) return null

  const title = p.currentTrack?.name ?? '—'
  const artist = p.currentTrack?.artist

  return (
    <footer className="player-bar">
      <div className="player-zone player-zone--now">
        <div className="player-art" aria-hidden>
          {initials(title)}
        </div>
        <div className="player-track-meta">
          <strong>{title}</strong>
          {artist ? <span className="muted"> · {artist}</span> : null}
        </div>
      </div>
      <div className="player-zone player-zone--controls">
        <button type="button" className="btn sm" onClick={() => p.prev()} disabled={p.currentIndex <= 0} aria-label="Anterior">
          Ant.
        </button>
        <button type="button" className="btn primary sm" onClick={() => p.toggle()} aria-label={p.isPlaying ? 'Pausa' : 'Reproducir'}>
          {p.isPlaying ? 'Pausa' : 'Reproducir'}
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => p.next()}
          disabled={p.currentIndex >= p.queue.length - 1}
          aria-label="Siguiente"
        >
          Sig.
        </button>
      </div>
      <div className="player-zone player-zone--extras" aria-hidden />
      <div className="player-seek">
        <span className="time">{formatTime(p.currentTime)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, p.duration || 0)}
          step={0.1}
          value={Math.min(p.currentTime, Math.max(1e-6, p.duration || 0))}
          onChange={(e) => p.seek(Number(e.target.value))}
          aria-label="Progreso de reproducción"
        />
        <span className="time">{formatTime(p.duration)}</span>
      </div>
      {p.error ? <p className="player-error-banner" role="alert">{p.error}</p> : null}
    </footer>
  )
}
