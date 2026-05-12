import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getDriveItem } from '../api/graphClient'
import { useGraphAccessToken } from '../hooks/useGraphAccessToken'
import type { PlayerTrackRef } from '../types/player'

/* eslint-disable react-refresh/only-export-components */

export type { PlayerTrackRef } from '../types/player'

type Ctx = {
  queue: PlayerTrackRef[]
  currentIndex: number
  currentTrack: PlayerTrackRef | null
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string | null
  playSingle: (t: PlayerTrackRef) => void
  playQueue: (tracks: PlayerTrackRef[], startIndex?: number) => void
  enqueue: (t: PlayerTrackRef) => void
  clearQueue: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (seconds: number) => void
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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const lastTimeTick = useRef(0)

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

  const resolveUrlAndPlay = useCallback(
    async (track: PlayerTrackRef) => {
      const el = audioRef.current
      if (!el) return
      setError(null)
      const token = await acquireToken()
      const item = await getDriveItem(token, track.id)
      const url = item['@microsoft.graph.downloadUrl']
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
      setCurrentTime(el.currentTime)
    }
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0)
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
  }, [goNext, resolveUrlAndPlay])

  const playSingle = useCallback(
    (t: PlayerTrackRef) => {
      queueRef.current = [t]
      setQueue([t])
      indexRef.current = 0
      setCurrentIndex(0)
      void resolveUrlAndPlay(t)
    },
    [resolveUrlAndPlay],
  )

  const playQueue = useCallback(
    (tracks: PlayerTrackRef[], startIndex = 0) => {
      if (!tracks.length) return
      queueRef.current = tracks
      setQueue(tracks)
      const i = Math.min(Math.max(0, startIndex), tracks.length - 1)
      indexRef.current = i
      setCurrentIndex(i)
      void playAtIndex(i, tracks)
    },
    [playAtIndex],
  )

  const enqueue = useCallback((t: PlayerTrackRef) => {
    setQueue((q) => {
      const n = [...q, t]
      queueRef.current = n
      return n
    })
  }, [])

  const clearQueue = useCallback(() => {
    audioRef.current?.pause()
    queueRef.current = []
    setQueue([])
    indexRef.current = 0
    setCurrentIndex(0)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const value: Ctx = {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    error,
    playSingle,
    playQueue,
    enqueue,
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
