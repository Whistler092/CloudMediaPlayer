import { usePlayer } from '../player/PlayerContext'

function formatTime(s: number) {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export type PlayerTransportVariant = 'panel' | 'bar'

function IconPrev() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
    </svg>
  )
}

function IconNext() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 18h-2V6h2v12zM6 18l8.5-6L6 6v12z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function IconSpinner() {
  return <span className="player-spinner" aria-hidden />
}

export function PlayerTransport({ variant }: { variant: PlayerTransportVariant }) {
  const p = usePlayer()
  if (!p.currentTrack && p.queue.length === 0) return null

  const busy = p.isLoadingPlayback
  const rootClass =
    variant === 'panel' ? 'player-transport player-transport--panel' : 'player-transport player-transport--bar'

  return (
    <div className={rootClass} aria-label="Controles de reproducción" aria-busy={busy}>
      {variant === 'panel' ? (
        <div className="player-zone player-zone--controls player-zone--controls--panel-icons">
          <button
            type="button"
            className="btn-icon queue-panel-transport-icon"
            onClick={() => p.prev()}
            disabled={busy || p.currentIndex <= 0}
            aria-label="Anterior"
          >
            <IconPrev />
          </button>
          <button
            type="button"
            className="btn-icon queue-panel-transport-icon queue-panel-transport-icon--play"
            onClick={() => p.toggle()}
            disabled={busy}
            aria-label={busy ? 'Preparando reproducción' : p.isPlaying ? 'Pausa' : 'Reproducir'}
          >
            {busy ? <IconSpinner /> : p.isPlaying ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            className="btn-icon queue-panel-transport-icon"
            onClick={() => p.next()}
            disabled={busy || p.currentIndex >= p.queue.length - 1}
            aria-label="Siguiente"
          >
            <IconNext />
          </button>
        </div>
      ) : (
        <div className="player-zone player-zone--controls">
          <button
            type="button"
            className="btn sm"
            onClick={() => p.prev()}
            disabled={busy || p.currentIndex <= 0}
            aria-label="Anterior"
          >
            Ant.
          </button>
          <button
            type="button"
            className="btn primary sm"
            onClick={() => p.toggle()}
            disabled={busy}
            aria-label={busy ? 'Preparando reproducción' : p.isPlaying ? 'Pausa' : 'Reproducir'}
          >
            {busy ? '…' : p.isPlaying ? 'Pausa' : 'Reproducir'}
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() => p.next()}
            disabled={busy || p.currentIndex >= p.queue.length - 1}
            aria-label="Siguiente"
          >
            Sig.
          </button>
        </div>
      )}
      {busy ? (
        <p className="player-transport-loading-hint muted small" aria-live="polite">
          Obteniendo audio desde OneDrive…
        </p>
      ) : null}
      <div className="player-seek">
        <span className="time">{formatTime(p.currentTime)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, p.duration || 0)}
          step={0.1}
          value={Math.min(p.currentTime, Math.max(1e-6, p.duration || 0))}
          onChange={(e) => p.seek(Number(e.target.value))}
          disabled={busy}
          aria-label="Progreso de reproducción"
        />
        <span className="time">{formatTime(p.duration)}</span>
      </div>
      {p.error ? (
        <p className={variant === 'panel' ? 'queue-panel-error' : 'player-error-banner'} role="alert">
          {p.error}
        </p>
      ) : null}
    </div>
  )
}
