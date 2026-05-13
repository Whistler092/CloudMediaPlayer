import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore'
import { getFirebase } from '../lib/firebase'
import { clearIndexedLibrary } from '../lib/clearIndexedLibrary'
import { useFirebaseUser } from '../hooks/useFirebaseUser'
import { isFirebaseConfigured } from '../config/env'
import { userLibRootsCol, userLibTracksCol } from '../firestore/paths'
import type { LibraryRootDoc, LibraryTrackDoc } from '../types/firestore'
import { usePlayer } from '../player/PlayerContext'
import type { PlayerTrackRef } from '../types/player'
import { filterIndexedTracks } from '../lib/indexedTrackSearch'

type TrackRow = LibraryTrackDoc & { id: string }

type SortKey = 'name' | 'folderPath' | 'artist' | 'album'
type SortDir = 'asc' | 'desc'

const FIRESTORE_PAGE = 500
const UI_PAGE_SIZE = 120

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

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

/** Cola + signo “+” (añadir al final), legible a tamaño pequeño. */
function IconAddToQueue() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="7" x2="14" y2="7" />
      <line x1="4" y1="12" x2="12" y2="12" />
      <line x1="4" y1="17" x2="10" y2="17" />
      <circle cx="17.5" cy="12" r="4.25" fill="none" />
      <path d="M17.5 10.2v3.6M15.7 12h3.6" strokeWidth="2" />
    </svg>
  )
}

function LibrarySkeleton() {
  return (
    <div className="tbl-wrap" aria-busy="true" aria-label="Cargando biblioteca">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-line skeleton-block short" />
          <div className="skeleton-line skeleton-block" />
          <div className="skeleton-line skeleton-block short" />
          <div className="skeleton-line skeleton-block short" />
        </div>
      ))}
    </div>
  )
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
  const [loadProgress, setLoadProgress] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [uiPage, setUiPage] = useState(0)

  const loadData = useCallback(async () => {
    if (!fb || !firebaseUid || !firebaseReady) {
      setTracks([])
      setRoots([])
      setLoadProgress(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadProgress('0 pistas')
    const all: TrackRow[] = []
    let last: QueryDocumentSnapshot | null = null
    try {
      while (true) {
        const col = userLibTracksCol(fb.db, firebaseUid)
        let snap: QuerySnapshot
        if (last) {
          snap = await getDocs(query(col, orderBy('name'), startAfter(last), limit(FIRESTORE_PAGE)))
        } else {
          snap = await getDocs(query(col, orderBy('name'), limit(FIRESTORE_PAGE)))
        }
        if (snap.empty) break
        for (const d of snap.docs) {
          const x = d.data() as LibraryTrackDoc
          all.push({ ...x, id: d.id })
        }
        setLoadProgress(`${all.length} pistas…`)
        last = snap.docs[snap.docs.length - 1]!
        if (snap.docs.length < FIRESTORE_PAGE) break
      }

      const rq = query(userLibRootsCol(fb.db, firebaseUid), orderBy('displayPath'), limit(50))
      const rr = await getDocs(rq)
      setTracks(all)
      setRoots(rr.docs.map((d) => ({ id: d.id, data: d.data() as LibraryRootDoc })))
    } finally {
      setLoadProgress(null)
      setLoading(false)
    }
  }, [fb, firebaseUid, firebaseReady])

  useEffect(() => {
    queueMicrotask(() => {
      void loadData()
    })
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

  const filtered = useMemo(() => filterIndexedTracks(tracks, filter), [tracks, filter])

  const sorted = useMemo(
    () => sortTracks(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(sorted.length / UI_PAGE_SIZE))
    setUiPage((p) => Math.min(p, pages - 1))
  }, [sorted.length])

  const uiPageCount = Math.max(1, Math.ceil(sorted.length / UI_PAGE_SIZE))
  const safeUiPage = Math.min(uiPage, uiPageCount - 1)
  const pageSlice = useMemo(() => {
    const start = safeUiPage * UI_PAGE_SIZE
    return sorted.slice(start, start + UI_PAGE_SIZE)
  }, [sorted, safeUiPage])

  const rangeLabel = useMemo(() => {
    if (sorted.length === 0) return null
    const from = safeUiPage * UI_PAGE_SIZE + 1
    const to = Math.min(sorted.length, (safeUiPage + 1) * UI_PAGE_SIZE)
    return `${from}–${to}`
  }, [sorted.length, safeUiPage])

  const toRef = (t: TrackRow): PlayerTrackRef => ({
    id: t.id,
    name: t.name,
    artist: t.audioArtist ?? undefined,
    album: t.audioAlbum ?? undefined,
  })

  const addFilteredToQueue = useCallback(() => {
    if (sorted.length === 0) return
    player.enqueueMany(
      sorted.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.audioArtist ?? undefined,
        album: t.audioAlbum ?? undefined,
      })),
    )
  }, [player, sorted])

  if (!isFirebaseConfigured()) {
    return (
      <div className="page library">
        <h1>Biblioteca</h1>
        <div className="empty-state">
          <div className="empty-state-icon">◎</div>
          <h2>Firebase no configurado</h2>
          <p>
            Añade las variables <code>VITE_FIREBASE_*</code> en <code>.env</code> para ver el índice.
          </p>
        </div>
      </div>
    )
  }
  if (!firebaseReady || !firebaseUid) {
    return (
      <div className="page library">
        <h1>Biblioteca</h1>
        <div className="empty-state">
          <div className="empty-state-icon">⋯</div>
          <h2>Conectando…</h2>
          <p>Esperando autenticación Firebase anónima.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page library">
      <h1>Biblioteca</h1>
      <p className="page-lead">Pistas indexadas desde OneDrive. Ordena, busca y reproduce.</p>
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
        {roots.length === 0 && <p className="muted">Aún no hay carpetas indexadas. Escanea desde el Explorador.</p>}
        <ul className="roots">
          {roots.map((r) => (
            <li key={r.id}>
              <strong>{r.data.displayPath}</strong> — {r.data.indexedTrackCount} pistas —{' '}
              <span className="muted">{r.data.scanStatus}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="toolbar toolbar-sticky wrap">
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

      {loading && (
        <>
          {loadProgress ? (
            <p className="muted small library-load-progress" aria-live="polite">
              Cargando desde Firebase… {loadProgress}
            </p>
          ) : null}
          <LibrarySkeleton />
        </>
      )}
      {!loading && sorted.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">♪</div>
          <h2>Sin pistas que mostrar</h2>
          <p>
            {tracks.length === 0
              ? 'Indexa una carpeta desde el Explorador para llenar tu biblioteca.'
              : 'Ningún resultado con este filtro. Prueba otra búsqueda.'}
          </p>
        </div>
      )}
      {!loading && sorted.length > 0 && (
        <>
          <div className="library-table-meta muted small">
            {sorted.length} pista{sorted.length === 1 ? '' : 's'}
            {rangeLabel ? ` · filas ${rangeLabel}` : ''} · {UI_PAGE_SIZE} por página
          </div>
          <div className="tbl-wrap library-tbl-wrap">
            <table className="tbl library-tbl">
              <thead>
                <tr>
                  <th className="col-folder">Carpeta</th>
                  <th className="col-name">Nombre</th>
                  <th className="col-meta">Artista</th>
                  <th colSpan={2} className="library-th-album-actions">
                    <div className="library-th-album-actions-inner">
                      <span className="library-th-album-actions-label">Álbum</span>
                      <button
                        type="button"
                        className="btn sm ghost library-add-all-queue"
                        onClick={() => addFilteredToQueue()}
                        title={`Agregar a la cola las ${sorted.length} pista${sorted.length === 1 ? '' : 's'} visibles (filtro + orden actual)`}
                        aria-label={`Agregar a la cola las ${sorted.length} pistas filtradas`}
                      >
                        <IconAddToQueue />
                        <span className="library-add-all-queue__text"></span>
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((t) => {
                  const folder = t.folderPath?.trim() || ''
                  return (
                    <tr key={t.id}>
                      <td className="col-folder muted small" title={folder || undefined}>
                        {folder || '—'}
                      </td>
                      <td className="col-name" title={t.name}>
                        {t.name}
                      </td>
                      <td className="col-meta" title={t.audioArtist ?? undefined}>
                        {t.audioArtist?.trim() || '—'}
                      </td>
                      <td className="col-meta" title={t.audioAlbum ?? undefined}>
                        {t.audioAlbum?.trim() || '—'}
                      </td>
                      <td className="col-actions">
                        <div className="library-row-actions">
                          <button
                            type="button"
                            className="btn-icon library-row-action"
                            onClick={() => player.playSingle(toRef(t))}
                            aria-label={`Reproducir ${t.name}`}
                            title="Reproducir ahora"
                          >
                            <IconPlay />
                          </button>
                          <button
                            type="button"
                            className="btn-icon library-row-action"
                            onClick={() => player.enqueue(toRef(t))}
                            aria-label={`Añadir a la cola: ${t.name}`}
                            title="Añadir a la cola de reproducción"
                          >
                            <IconAddToQueue />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {uiPageCount > 1 ? (
            <nav className="library-pager" aria-label="Paginación de la tabla">
              <button
                type="button"
                className="btn sm"
                disabled={safeUiPage <= 0}
                onClick={() => setUiPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span className="muted small">
                Página {safeUiPage + 1} de {uiPageCount}
              </span>
              <button
                type="button"
                className="btn sm"
                disabled={safeUiPage >= uiPageCount - 1}
                onClick={() => setUiPage((p) => Math.min(uiPageCount - 1, p + 1))}
              >
                Siguiente
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}
