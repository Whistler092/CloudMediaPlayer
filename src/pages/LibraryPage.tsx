import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDocs, limit, orderBy, query } from 'firebase/firestore'
import { getFirebase } from '../lib/firebase'
import { clearIndexedLibrary } from '../lib/clearIndexedLibrary'
import { useFirebaseUser } from '../hooks/useFirebaseUser'
import { isFirebaseConfigured } from '../config/env'
import { userLibRootsCol, userLibTracksCol } from '../firestore/paths'
import type { LibraryRootDoc, LibraryTrackDoc } from '../types/firestore'
import { usePlayer } from '../player/PlayerContext'
import type { PlayerTrackRef } from '../types/player'

type TrackRow = LibraryTrackDoc & { id: string }

type SortKey = 'name' | 'folderPath' | 'artist' | 'album'
type SortDir = 'asc' | 'desc'

function compareLocale(a: string, b: string, dir: SortDir): number {
  const sign = dir === 'asc' ? 1 : -1
  return sign * a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function sortTracks(rows: TrackRow[], key: SortKey, dir: SortDir): TrackRow[] {
  const list = [...rows]
  const emptyLast = (pa: string, pb: string): number | null => {
    const aEmpty = !pa.trim()
    const bEmpty = !pb.trim()
    if (aEmpty && bEmpty) return 0
    if (aEmpty) return 1
    if (bEmpty) return -1
    return null
  }

  list.sort((a, b) => {
    switch (key) {
      case 'name':
        return compareLocale(a.name, b.name, dir)
      case 'folderPath': {
        const pa = (a.folderPath ?? '').trim()
        const pb = (b.folderPath ?? '').trim()
        const tie = emptyLast(pa, pb)
        if (tie !== null) return tie
        const c = compareLocale(pa, pb, dir)
        if (c !== 0) return c
        return compareLocale(a.name, b.name, 'asc')
      }
      case 'artist': {
        const pa = (a.audioArtist ?? '').trim()
        const pb = (b.audioArtist ?? '').trim()
        const tie = emptyLast(pa, pb)
        if (tie !== null) return tie
        const c = compareLocale(pa, pb, dir)
        if (c !== 0) return c
        return compareLocale(a.name, b.name, 'asc')
      }
      case 'album': {
        const pa = (a.audioAlbum ?? '').trim()
        const pb = (b.audioAlbum ?? '').trim()
        const tie = emptyLast(pa, pb)
        if (tie !== null) return tie
        const c = compareLocale(pa, pb, dir)
        if (c !== 0) return c
        return compareLocale(a.name, b.name, 'asc')
      }
      default:
        return 0
    }
  })
  return list
}

export function LibraryPage() {
  const { firebaseUid, firebaseReady } = useFirebaseUser()
  const fb = getFirebase()
  const player = usePlayer()
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [roots, setRoots] = useState<{ id: string; data: LibraryRootDoc }[]>([])
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('folderPath')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const loadData = useCallback(async () => {
    if (!fb || !firebaseUid || !firebaseReady) {
      setTracks([])
      setRoots([])
      setLoading(false)
      return
    }
    setLoading(true)
    const tq = query(userLibTracksCol(fb.db, firebaseUid), orderBy('name'), limit(500))
    const tr = await getDocs(tq)
    const rq = query(userLibRootsCol(fb.db, firebaseUid), orderBy('displayPath'), limit(50))
    const rr = await getDocs(rq)
    setTracks(
      tr.docs.map((d) => {
        const x = d.data() as LibraryTrackDoc
        return { ...x, id: d.id }
      }),
    )
    setRoots(rr.docs.map((d) => ({ id: d.id, data: d.data() as LibraryRootDoc })))
    setLoading(false)
  }, [fb, firebaseUid, firebaseReady])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleClearIndex = async () => {
    if (!fb || !firebaseUid) return
    if (
      !confirm(
        '¿Eliminar todo el índice (pistas y raíces escaneadas)? Las playlists no se borran; pueden quedar referencias a pistas que ya no existen.',
      )
    ) {
      return
    }
    setClearing(true)
    try {
      await clearIndexedLibrary(fb.db, firebaseUid)
      await loadData()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'No se pudo borrar el índice')
    } finally {
      setClearing(false)
    }
  }

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return tracks
    return tracks.filter((t) => {
      const folder = (t.folderPath ?? '').toLowerCase()
      return (
        t.name.toLowerCase().includes(f) ||
        folder.includes(f) ||
        (t.audioArtist && t.audioArtist.toLowerCase().includes(f)) ||
        (t.audioAlbum && t.audioAlbum.toLowerCase().includes(f))
      )
    })
  }, [tracks, filter])

  const sorted = useMemo(
    () => sortTracks(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )

  const toRef = (t: TrackRow): PlayerTrackRef => ({
    id: t.id,
    name: t.name,
    artist: t.audioArtist ?? undefined,
    album: t.audioAlbum ?? undefined,
  })

  if (!isFirebaseConfigured()) {
    return <p className="hint">Configura Firebase en .env para ver la biblioteca indexada.</p>
  }
  if (!firebaseReady || !firebaseUid) {
    return <p className="hint">Esperando autenticación Firebase…</p>
  }

  return (
    <div className="page library">
      <h1>Biblioteca (índice)</h1>
      <section className="card">
        <div className="card-head">
          <h2>Raíces escaneadas</h2>
          <button
            type="button"
            className="btn sm ghost danger"
            disabled={clearing || loading || (roots.length === 0 && tracks.length === 0)}
            onClick={() => void handleClearIndex()}
          >
            {clearing ? 'Borrando…' : 'Eliminar índice'}
          </button>
        </div>
        {roots.length === 0 && <p className="muted">Aún no hay carpetas indexadas.</p>}
        <ul className="roots">
          {roots.map((r) => (
            <li key={r.id}>
              <strong>{r.data.displayPath}</strong> — {r.data.indexedTrackCount} pistas —{' '}
              <span className="muted">{r.data.scanStatus}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="toolbar wrap">
        <input
          type="search"
          placeholder="Buscar por nombre, carpeta, artista o álbum…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input"
        />
        <label className="toolbar-label">
          Ordenar por{' '}
          <select
            className="input sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="folderPath">Carpeta (ruta)</option>
            <option value="name">Nombre de archivo</option>
            <option value="artist">Artista</option>
            <option value="album">Álbum</option>
          </select>
        </label>
        <label className="toolbar-label">
          Dirección{' '}
          <select
            className="input sm"
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as SortDir)}
          >
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </label>
      </div>
      <p className="hint small">
        Artista y álbum vienen de Microsoft Graph al indexar (metadatos del archivo). La columna{' '}
        <strong>Carpeta</strong> se rellena en escaneos nuevos; para pistas antiguas, vuelve a escanear la raíz.
      </p>
      {loading && <p>Cargando…</p>}
      {!loading && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Carpeta</th>
              <th>Nombre</th>
              <th>Artista</th>
              <th>Álbum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td className="muted small">{t.folderPath?.trim() || '—'}</td>
                <td>{t.name}</td>
                <td>{t.audioArtist ?? '—'}</td>
                <td>{t.audioAlbum ?? '—'}</td>
                <td className="actions">
                  <button type="button" className="btn sm" onClick={() => player.playSingle(toRef(t))}>
                    Reproducir
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => player.enqueue(toRef(t))}>
                    Cola
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
