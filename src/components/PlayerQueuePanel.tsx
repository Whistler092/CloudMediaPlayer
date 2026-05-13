import { useCallback, useState } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { PlayerTransport } from './PlayerTransport'

const LS_KEY = 'queuePanelExpanded'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const w = parts[0] ?? '?'
  return w.slice(0, 2).toUpperCase()
}

function IconChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function IconQueue() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

function readExpanded(): boolean {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

function writeExpanded(expanded: boolean) {
  try {
    localStorage.setItem(LS_KEY, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export type PlayerQueuePanelProps = {
  mobileQueueOpen: boolean
  onMobileQueueOpenChange: (open: boolean) => void
}

export function PlayerQueuePanel({ mobileQueueOpen, onMobileQueueOpenChange }: PlayerQueuePanelProps) {
  const p = usePlayer()
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(() => readExpanded())

  const setExpandedPersist = useCallback((next: boolean) => {
    setExpanded(next)
    writeExpanded(next)
  }, [])

  const toggleExpanded = useCallback(() => {
    if (isMobile) {
      onMobileQueueOpenChange(!mobileQueueOpen)
      return
    }
    setExpandedPersist(!expanded)
  }, [expanded, isMobile, mobileQueueOpen, onMobileQueueOpenChange, setExpandedPersist])

  const showFullPanel = isMobile ? mobileQueueOpen : expanded
  const showSlimRail = !isMobile && !expanded && p.isPlaying && !!p.currentTrack
  const showIconRail = !isMobile && !expanded && !showSlimRail

  const asideClass = [
    'queue-panel',
    isMobile && 'queue-panel--mobile',
    isMobile && mobileQueueOpen && 'queue-panel--drawer-open',
    !isMobile && expanded && 'queue-panel--expanded',
    showSlimRail && 'queue-panel--collapsed-playing',
    showIconRail && 'queue-panel--collapsed-idle',
  ]
    .filter(Boolean)
    .join(' ')

  const title = p.currentTrack?.name ?? '—'
  const artist = p.currentTrack?.artist
  const hasQueue = p.queue.length > 0

  const clearWithConfirm = () => {
    if (!hasQueue) return
    if (window.confirm('¿Vaciar la cola de reproducción?')) p.clearQueue()
  }

  const closeMobileDrawer = () => onMobileQueueOpenChange(false)

  return (
    <>
      {isMobile && mobileQueueOpen ? (
        <button
          type="button"
          className="queue-panel-scrim"
          aria-label="Cerrar cola"
          onClick={closeMobileDrawer}
        />
      ) : null}
      <aside className={asideClass} aria-label="Cola de reproducción">
        <div className="queue-panel-header">
          <button
            type="button"
            className="btn-icon queue-panel-toggle"
            onClick={toggleExpanded}
            aria-expanded={showFullPanel}
            aria-controls="queue-panel-body"
            title={showFullPanel ? 'Contraer panel' : 'Expandir panel'}
          >
            {isMobile ? <IconChevronRight /> : showFullPanel ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
          {showFullPanel ? (
            <span className="queue-panel-title">Cola</span>
          ) : null}
          {isMobile && mobileQueueOpen ? (
            <button type="button" className="btn ghost sm queue-panel-close-mobile" onClick={closeMobileDrawer}>
              Cerrar
            </button>
          ) : null}
        </div>

        {showIconRail && !showFullPanel ? (
          <button
            type="button"
            className="queue-panel-icon-only"
            onClick={() => setExpandedPersist(true)}
            aria-label="Expandir panel de cola"
          >
            <IconQueue />
          </button>
        ) : null}

        {showFullPanel ? (
          <div className="queue-panel-body" id="queue-panel-body">
            <div className="queue-panel-player-card">
              <div className="queue-panel-now">
                <div className="queue-panel-art" aria-hidden>
                  {p.currentTrack ? initials(p.currentTrack.name) : '♪'}
                </div>
                <div className="queue-panel-now-meta">
                  <strong className="queue-panel-now-title" title={p.currentTrack ? p.currentTrack.name : undefined}>
                    {p.currentTrack ? title : 'Sin reproducción'}
                  </strong>
                  {p.currentTrack && artist ? <span className="muted queue-panel-now-artist">{artist}</span> : null}
                  {!p.currentTrack ? (
                    <span className="muted small">La cola está vacía. Reproduce desde Biblioteca o Explorador.</span>
                  ) : null}
                </div>
              </div>

              <PlayerTransport variant="panel" />
            </div>

            <div className="queue-panel-list-wrap">
              {hasQueue ? (
                <ul className="queue-panel-list" role="listbox" aria-label="Pistas en cola">
                  {p.queue.map((t, i) => {
                    const active = i === p.currentIndex
                    return (
                      <li key={`${t.id}-${i}`} role="none">
                        <button
                          type="button"
                          role="option"
                          className={active ? 'queue-panel-row active' : 'queue-panel-row'}
                          aria-current={active ? 'true' : undefined}
                          onClick={() => {
                            p.playQueueIndex(i)
                            if (isMobile) closeMobileDrawer()
                          }}
                        >
                          <span className="queue-panel-row-idx">{i + 1}</span>
                          <span className="queue-panel-row-text">
                            <span className="queue-panel-row-title">{t.name}</span>
                            {t.artist ? <span className="muted small">{t.artist}</span> : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="queue-panel-empty muted small">No hay pistas en la cola.</div>
              )}
            </div>

            {hasQueue ? (
              <div className="queue-panel-footer">
                <button type="button" className="btn ghost sm" onClick={clearWithConfirm}>
                  Vaciar cola
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showSlimRail ? (
          <div className="queue-panel-slim" aria-label="Reproducción actual">
            <div className="queue-panel-slim-art" aria-hidden>
              {p.currentTrack ? initials(p.currentTrack.name) : '♪'}
            </div>
            <div className="queue-panel-slim-title" title={title}>
              {title}
            </div>
            <div className="queue-panel-slim-controls">
              <button
                type="button"
                className="btn-icon queue-panel-slim-btn"
                onClick={() => p.prev()}
                disabled={p.currentIndex <= 0}
                aria-label="Anterior"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
                </svg>
              </button>
              <button
                type="button"
                className="btn-icon queue-panel-slim-btn queue-panel-slim-btn--play"
                onClick={() => p.toggle()}
                aria-label={p.isPlaying ? 'Pausa' : 'Reproducir'}
              >
                {p.isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7L8 5z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="btn-icon queue-panel-slim-btn"
                onClick={() => p.next()}
                disabled={p.currentIndex >= p.queue.length - 1}
                aria-label="Siguiente"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M16 18h-2V6h2v12zM6 18l8.5-6L6 6v12z" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  )
}

export function MobileQueueTrigger({ onOpen }: { onOpen: () => void }) {
  const isMobile = useIsMobile()
  if (!isMobile) return null
  return (
    <button
      type="button"
      className="btn-icon mobile-queue-trigger"
      aria-label="Abrir cola de reproducción"
      onClick={onOpen}
    >
      <IconQueue />
    </button>
  )
}
