import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { GraphDriveItem } from '../api/graphTypes'
import { getDriveItem } from '../api/graphClient'
import { useGraphAccessToken } from '../hooks/useGraphAccessToken'
import type { PlayerTrackRef } from '../types/player'

/* eslint-disable react-refresh/only-export-components */

export type { PlayerTrackRef } from '../types/player'

/** Segundos antes del final en los que se pide la siguiente pista a Graph (si hay siguiente en cola). */
const NEXT_TRACK_PREFETCH_LEAD_SEC = 10

type PrefetchedPlayback = {
  trackId: string
  url: string
  item: GraphDriveItem
}

type Ctx = {
  queue: PlayerTrackRef[]
  currentIndex: number
  currentTrack: PlayerTrackRef | null
  isPlaying: boolean
  /** True mientras se obtiene token, URL de Graph y el audio está listo para `play()`. */
  isLoadingPlayback: boolean
  currentTime: number
  duration: number
  error: string | null
  playSingle: (t: PlayerTrackRef) => void
  playQueue: (tracks: PlayerTrackRef[], startIndex?: number) => void
  enqueue: (t: PlayerTrackRef) => void
  enqueueMany: (tracks: PlayerTrackRef[]) => void
  clearQueue: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (seconds: number) => void
  playQueueIndex: (index: number) => void
}

const PlayerContext = createContext<Ctx | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const acquireToken = useGraphAccessToken()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<PlayerTrackRef[]>([])
  const indexRef = useRef(0)

  const [queue, setQueue] = useState<PlayerTrackRef[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingPlayback, setIsLoadingPlayback] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const lastTimeTick = useRef(0)
  const prefetchedRef = useRef<PrefetchedPlayback | null>(null)
  const prefetchInFlightIdRef = useRef<string | null>(null)
  const isPlayingRef = useRef(isPlaying)
  const isLoadingPlaybackRef = useRef(isLoadingPlayback)

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  useEffect(() => {
    isLoadingPlaybackRef.current = isLoadingPlayback
  }, [isLoadingPlayback])

  const clearPlaybackPrefetch = useCallback(() => {
    prefetchedRef.current = null
    prefetchInFlightIdRef.current = null
  }, [])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])
  useEffect(() => {
    indexRef.current = currentIndex
  }, [currentIndex])

  const currentTrack =
    queue.length > 0 && currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]!
      : null

  /** Si la cola o el índice cambian y el “siguiente” ya no coincide, descartar prefetch. */
  useEffect(() => {
    const next = queue[currentIndex + 1]
    const pid = prefetchedRef.current?.trackId
    if (!pid) return
    if (!next || next.id !== pid) {
      prefetchedRef.current = null
    }
  }, [queue, currentIndex])

  const resolveUrlAndPlay = useCallback(
    async (track: PlayerTrackRef) => {
      const el = audioRef.current
      if (!el) return

      const snap = prefetchedRef.current
      let fromPrefetch: PrefetchedPlayback | null = null
      if (snap?.trackId === track.id) {
        fromPrefetch = snap
        prefetchedRef.current = null
      } else if (snap) {
        prefetchedRef.current = null
      }
      prefetchInFlightIdRef.current = null

      setIsLoadingPlayback(true)
      setError(null)
      try {
        let item: GraphDriveItem
        let url: string
        if (fromPrefetch) {
          item = fromPrefetch.item
          url = fromPrefetch.url
        } else {
          const token = await acquireToken()
          item = await getDriveItem(token, track.id)
          url = item['@microsoft.graph.downloadUrl'] ?? ''
        }
        if (!url) {
          setError('No hay URL de descarga para este archivo (Graph).')
          return
        }
        el.src = url
        if (item.audio?.title || item.audio?.artist) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: item.audio.title ?? track.name,
              artist: item.audio.artist ?? track.artist ?? '',
              album: item.audio.album ?? track.album ?? '',
            })
          } catch {
            /* ignore */
          }
        } else {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: track.name,
              artist: track.artist ?? '',
              album: track.album ?? '',
            })
          } catch {
            /* ignore */
          }
        }
        try {
          await el.play()
          setIsPlaying(true)
        } catch (e) {
          if (e instanceof Error && e.name === 'NotAllowedError') {
            setError('El navegador bloqueó la reproducción automática; pulsa Reproducir.')
          } else {
            setError(e instanceof Error ? e.message : 'Error al reproducir')
          }
        }
      } finally {
        setIsLoadingPlayback(false)
      }
    },
    [acquireToken],
  )

  const maybePrefetchNext = useCallback(
    async (audioCurrentTime: number, audioDuration: number) => {
      if (!Number.isFinite(audioDuration) || audioDuration <= 0) return
      const remaining = audioDuration - audioCurrentTime
      if (remaining > NEXT_TRACK_PREFETCH_LEAD_SEC) return

      const q = queueRef.current
      const ci = indexRef.current
      const ni = ci + 1
      if (ni >= q.length) return
      const nextTrack = q[ni]!
      if (prefetchedRef.current?.trackId === nextTrack.id) return
      if (prefetchInFlightIdRef.current === nextTrack.id) return

      prefetchInFlightIdRef.current = nextTrack.id
      try {
        const token = await acquireToken()
        const item = await getDriveItem(token, nextTrack.id)
        const url = item['@microsoft.graph.downloadUrl']
        if (!url) return

        const q2 = queueRef.current
        const ci2 = indexRef.current
        if (ci2 !== ci || q2[ni]?.id !== nextTrack.id) return

        prefetchedRef.current = { trackId: nextTrack.id, url, item }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[player] prefetch next failed', e)
        }
        /* la reproducción siguiente reintentará Graph */
      } finally {
        if (prefetchInFlightIdRef.current === nextTrack.id) {
          prefetchInFlightIdRef.current = null
        }
      }
    },
    [acquireToken],
  )

  const playAtIndex = useCallback(
    async (index: number, q: PlayerTrackRef[]) => {
      const t = q[index]
      if (!t) return
      indexRef.current = index
      setCurrentIndex(index)
      await resolveUrlAndPlay(t)
    },
    [resolveUrlAndPlay],
  )

  const goNext = useCallback(async () => {
    const q = queueRef.current
    const ci = indexRef.current
    const ni = ci + 1
    if (ni < q.length) await playAtIndex(ni, q)
    else setIsPlaying(false)
  }, [playAtIndex])

  const goPrev = useCallback(async () => {
    const q = queueRef.current
    const ci = indexRef.current
    const pi = ci - 1
    if (pi >= 0) await playAtIndex(pi, q)
  }, [playAtIndex])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      const now = performance.now()
      if (now - lastTimeTick.current < 120) return
      lastTimeTick.current = now
      const cur = el.currentTime
      const dur = el.duration
      setCurrentTime(cur)
      void maybePrefetchNext(cur, dur)
    }
    /** Tras conocer duración: ventana final (pistas cortas) + disparo temprano del siguiente si hay cola. */
    const onMeta = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : 0
      setDuration(dur)
      void maybePrefetchNext(el.currentTime, el.duration)
      if (dur > 0) void maybePrefetchNext(dur, dur)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      void goNext()
    }
    const onError = async () => {
      const t = queueRef.current[indexRef.current]
      if (!t) return
      try {
        await resolveUrlAndPlay(t)
      } catch {
        setError('No se pudo renovar la URL de audio.')
      }
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
  }, [goNext, resolveUrlAndPlay, maybePrefetchNext])

  const playSingle = useCallback(
    (t: PlayerTrackRef) => {
      clearPlaybackPrefetch()
      queueRef.current = [t]
      setQueue([t])
      indexRef.current = 0
      setCurrentIndex(0)
      void resolveUrlAndPlay(t)
    },
    [resolveUrlAndPlay, clearPlaybackPrefetch],
  )

  const playQueue = useCallback(
    (tracks: PlayerTrackRef[], startIndex = 0) => {
      if (!tracks.length) return
      clearPlaybackPrefetch()
      queueRef.current = tracks
      setQueue(tracks)
      const i = Math.min(Math.max(0, startIndex), tracks.length - 1)
      indexRef.current = i
      setCurrentIndex(i)
      void playAtIndex(i, tracks)
    },
    [playAtIndex, clearPlaybackPrefetch],
  )

  const enqueue = useCallback((t: PlayerTrackRef) => {
    setQueue((q) => {
      const n = [...q, t]
      queueRef.current = n
      return n
    })
  }, [])

  const enqueueMany = useCallback(
    (tracks: PlayerTrackRef[]) => {
      if (!tracks.length) return
      const firstNewIndex = queueRef.current.length
      setQueue((q) => {
        const n = [...q, ...tracks]
        queueRef.current = n
        return n
      })
      const q = queueRef.current
      if (
        !isPlayingRef.current &&
        !isLoadingPlaybackRef.current &&
        firstNewIndex < q.length
      ) {
        void playAtIndex(firstNewIndex, q)
      }
    },
    [playAtIndex],
  )

  const clearQueue = useCallback(() => {
    clearPlaybackPrefetch()
    audioRef.current?.pause()
    queueRef.current = []
    setQueue([])
    indexRef.current = 0
    setCurrentIndex(0)
    setIsPlaying(false)
    setIsLoadingPlayback(false)
    setCurrentTime(0)
    setDuration(0)
  }, [clearPlaybackPrefetch])

  const playQueueIndex = useCallback(
    (index: number) => {
      const q = queueRef.current
      if (index < 0 || index >= q.length) return
      void playAtIndex(index, q)
    },
    [playAtIndex],
  )

  const value: Ctx = {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    isLoadingPlayback,
    currentTime,
    duration,
    error,
    playSingle,
    playQueue,
    enqueue,
    enqueueMany,
    clearQueue,
    pause: () => {
      audioRef.current?.pause()
    },
    resume: () => {
      void audioRef.current?.play()
    },
    toggle: () => {
      const el = audioRef.current
      if (!el) return
      if (el.paused) void el.play()
      else el.pause()
    },
    next: () => void goNext(),
    prev: () => void goPrev(),
    seek: (seconds: number) => {
      const el = audioRef.current
      if (!el) return
      el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds))
      setCurrentTime(el.currentTime)
    },
    playQueueIndex,
  }

  return (
    <PlayerContext.Provider value={value}>
      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />
      {children}
    </PlayerContext.Provider>
  )
}

/** Re-export del hook junto al provider (Fast Refresh). */
export function usePlayer() {
  const v = useContext(PlayerContext)
  if (!v) throw new Error('usePlayer fuera de PlayerProvider')
  return v
}
