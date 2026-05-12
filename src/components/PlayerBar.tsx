import { usePlayer } from '../player/PlayerContext'

function formatTime(s: number) {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const p = usePlayer()
  if (!p.currentTrack && p.queue.length === 0) return null

  return (
    <footer className="player-bar">
      <div className="player-track">
        <strong>{p.currentTrack?.name ?? '—'}</strong>
        {p.currentTrack?.artist && <span className="muted"> · {p.currentTrack.artist}</span>}
      </div>
      <div className="player-controls">
        <button type="button" className="btn sm" onClick={() => p.prev()} disabled={p.currentIndex <= 0}>
          Anterior
        </button>
        <button type="button" className="btn primary sm" onClick={() => p.toggle()}>
          {p.isPlaying ? 'Pausa' : 'Reproducir'}
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => p.next()}
          disabled={p.currentIndex >= p.queue.length - 1}
        >
          Siguiente
        </button>
      </div>
      <div className="player-seek">
        <span className="time">{formatTime(p.currentTime)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, p.duration || 0)}
          step={0.1}
          value={Math.min(p.currentTime, Math.max(1e-6, p.duration || 0))}
          onChange={(e) => p.seek(Number(e.target.value))}
          aria-label="Progreso"
        />
        <span className="time">{formatTime(p.duration)}</span>
      </div>
      {p.error && <p className="player-error">{p.error}</p>}
    </footer>
  )
}
