import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { getFirebase } from '../lib/firebase'
import { useFirebaseUser } from '../hooks/useFirebaseUser'
import { userLibTrackDoc, userPlaylistDoc } from '../firestore/paths'
import type { LibraryTrackDoc, PlaylistDoc } from '../types/firestore'
import { usePlayer } from '../player/PlayerContext'
import type { PlayerTrackRef } from '../types/player'
import { filterIndexedTracks, loadAllIndexedTracks, type IndexedTrackRow } from '../lib/indexedTrackSearch'

type Row = { id: string; name: string; artist: string | null; album: string | null }

const PICKER_PAGE_SIZE = 10

function rowToTrackRef(r: Row): PlayerTrackRef {
  const artist = r.artist?.trim()
  const album = r.album?.trim()
  return {
    id: r.id,
    name: r.name,
    ...(artist ? { artist } : {}),
    ...(album ? { album } : {}),
  }
}

function sortPickerRows(rows: IndexedTrackRow[], filter: string): IndexedTrackRow[] {
  const list = [...rows]
  const hasFilter = filter.trim().length > 0
  if (hasFilter) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    return list
  }
  list.sort((a, b) => {
    const ua = a.updatedAt instanceof Timestamp ? a.updatedAt.toMillis() : 0
    const ub = b.updatedAt instanceof Timestamp ? b.updatedAt.toMillis() : 0
    if (ub !== ua) return ub - ua
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  })
  return list
}

function IconPlayAll() {
  return (
    <svg className="playlist-play-all-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
    </svg>
  )
}

function PlaylistDetailSkeleton() {
  return (
    <div className="page playlist-detail" aria-busy="true" aria-label="Cargando playlist">
      <div className="skeleton-line skeleton-block short" style={{ marginBottom: '0.4rem' }} />
      <div className="playlist-detail-title-row" style={{ marginBottom: '0.65rem' }}>
        <div className="skeleton-line skeleton-block" style={{ flex: 1, height: 34, margin: 0 }} />
        <div className="skeleton-line skeleton-block" style={{ width: 40, height: 40, margin: 0, borderRadius: 8 }} />
      </div>
      <div className="tbl-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-line skeleton-block short" />
            <div className="skeleton-line skeleton-block" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const { firebaseUid, firebaseReady } = useFirebaseUser()
  const fb = getFirebase()
  const player = usePlayer()
  const [playlist, setPlaylist] = useState<PlaylistDoc | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [indexedTracks, setIndexedTracks] = useState<IndexedTrackRow[]>([])
  const [indexLoading, setIndexLoading] = useState(false)
  const [indexLoadProgress, setIndexLoadProgress] = useState<string | null>(null)
  const [pickerFilter, setPickerFilter] = useState('')
  const [pickerPage, setPickerPage] = useState(0)
  const [pickerAddingId, setPickerAddingId] = useState<string | null>(null)
  const pickerAddLockRef = useRef(false)

  const [reorderBusyIndex, setReorderBusyIndex] = useState<number | null>(null)
  const [removingIndex, setRemovingIndex] = useState<number | null>(null)

  const [renamingPlaylist, setRenamingPlaylist] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingPlaylistName, setSavingPlaylistName] = useState(false)

  const load = useCallback(async () => {
    if (!fb || !firebaseUid || !playlistId) return
    const pref = userPlaylistDoc(fb.db, firebaseUid, playlistId)
    const ps = await getDoc(pref)
    if (!ps.exists()) {
      setPlaylist(null)
      setRows([])
      return
    }
    const data = ps.data() as PlaylistDoc
    setPlaylist(data)
    const ids = data.orderedTrackIds ?? []
    const resolved: Row[] = []
    for (const id of ids) {
      const tr = await getDoc(userLibTrackDoc(fb.db, firebaseUid, id))
      if (tr.exists()) {
        const t = tr.data() as LibraryTrackDoc
        resolved.push({
          id,
          name: t.name,
          artist: t.audioArtist?.trim() ? t.audioArtist : null,
          album: t.audioAlbum?.trim() ? t.audioAlbum : null,
        })
      } else {
        resolved.push({ id, name: id, artist: null, album: null })
      }
    }
    setRows(resolved)
  }, [fb, firebaseUid, playlistId])

  useEffect(() => {
    if (!fb || !firebaseUid || !firebaseReady || !playlistId) {
      queueMicrotask(() => setLoading(false))
      return
    }
    let c = false
    ;(async () => {
      setLoading(true)
      await load()
      if (!c) setLoading(false)
    })()
    return () => {
      c = true
    }
  }, [fb, firebaseUid, firebaseReady, playlistId, load])

  useEffect(() => {
    if (!fb || !firebaseUid || !firebaseReady) {
      setIndexedTracks([])
      setIndexLoadProgress(null)
      setIndexLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setIndexLoading(true)
      setIndexLoadProgress('0 pistas')
      try {
        const rows = await loadAllIndexedTracks(fb.db, firebaseUid, (n) => {
          if (!cancelled) setIndexLoadProgress(`${n} pistas…`)
        })
        if (!cancelled) {
          setIndexedTracks(rows)
          setIndexLoadProgress(null)
        }
      } catch {
        if (!cancelled) setIndexedTracks([])
      } finally {
        if (!cancelled) {
          setIndexLoading(false)
          setIndexLoadProgress(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fb, firebaseUid, firebaseReady])

  useEffect(() => {
    setRenamingPlaylist(false)
    setNameDraft('')
  }, [playlistId])

  const savePlaylistName = useCallback(async () => {
    if (!fb || !firebaseUid || !playlistId || !playlist) return
    const next = nameDraft.trim()
    if (!next) {
      window.alert('El nombre no puede estar vacío.')
      return
    }
    if (next === playlist.name) {
      setRenamingPlaylist(false)
      return
    }
    setSavingPlaylistName(true)
    try {
      await updateDoc(userPlaylistDoc(fb.db, firebaseUid, playlistId), {
        name: next,
        updatedAt: serverTimestamp(),
      })
      await load()
      setRenamingPlaylist(false)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo guardar el nombre')
    } finally {
      setSavingPlaylistName(false)
    }
  }, [fb, firebaseUid, playlistId, playlist, nameDraft, load])

  const pickerFiltered = useMemo(
    () => filterIndexedTracks(indexedTracks, pickerFilter),
    [indexedTracks, pickerFilter],
  )

  const pickerSorted = useMemo(
    () => sortPickerRows(pickerFiltered, pickerFilter),
    [pickerFiltered, pickerFilter],
  )

  useEffect(() => {
    setPickerPage(0)
  }, [pickerFilter])

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(pickerSorted.length / PICKER_PAGE_SIZE))
    setPickerPage((p) => Math.min(p, pages - 1))
  }, [pickerSorted.length])

  const pickerPageCount = Math.max(1, Math.ceil(pickerSorted.length / PICKER_PAGE_SIZE))
  const safePickerPage = Math.min(pickerPage, pickerPageCount - 1)
  const pickerSlice = useMemo(() => {
    const start = safePickerPage * PICKER_PAGE_SIZE
    return pickerSorted.slice(start, start + PICKER_PAGE_SIZE)
  }, [pickerSorted, safePickerPage])

  const pickerRangeLabel = useMemo(() => {
    if (pickerSorted.length === 0) return null
    const from = safePickerPage * PICKER_PAGE_SIZE + 1
    const to = Math.min(pickerSorted.length, (safePickerPage + 1) * PICKER_PAGE_SIZE)
    return `${from}–${to}`
  }, [pickerSorted.length, safePickerPage])

  const persistIds = async (nextIds: string[]) => {
    if (!fb || !firebaseUid || !playlistId) return
    await updateDoc(userPlaylistDoc(fb.db, firebaseUid, playlistId), {
      orderedTrackIds: nextIds,
      updatedAt: serverTimestamp(),
    })
    await load()
  }

  const move = async (index: number, dir: -1 | 1) => {
    if (reorderBusyIndex !== null || removingIndex !== null) return
    const ids = rows.map((r) => r.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const copy = [...ids]
    const t = copy[index]!
    copy[index] = copy[j]!
    copy[j] = t
    setReorderBusyIndex(index)
    try {
      await persistIds(copy)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo reordenar')
    } finally {
      setReorderBusyIndex(null)
    }
  }

  const removeAt = async (index: number) => {
    if (reorderBusyIndex !== null || removingIndex !== null) return
    const ids = rows.map((r) => r.id)
    ids.splice(index, 1)
    setRemovingIndex(index)
    try {
      await persistIds(ids)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo quitar la pista')
    } finally {
      setRemovingIndex(null)
    }
  }

  const addTrackById = async (id: string): Promise<boolean> => {
    const trimmed = id.trim()
    if (!trimmed) return false
    if (pickerAddLockRef.current) return false
    if (rows.some((r) => r.id === trimmed)) {
      window.alert('Esa pista ya está en la playlist.')
      return false
    }
    pickerAddLockRef.current = true
    setPickerAddingId(trimmed)
    try {
      await persistIds([...rows.map((r) => r.id), trimmed])
      return true
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo añadir la pista')
      return false
    } finally {
      pickerAddLockRef.current = false
      setPickerAddingId(null)
    }
  }

  const playAll = () => {
    player.playQueue(rows.map(rowToTrackRef), 0)
  }

  if (!playlistId) return <p className="hint">Playlist no encontrada.</p>
  if (loading) return <PlaylistDetailSkeleton />
  if (!playlist) {
    return (
      <div className="page playlist-detail">
        <div className="empty-state">
          <h2>No existe esta playlist</h2>
          <p>
            <Link to="/playlists">Volver a Playlists</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page playlist-detail">
      <Link to="/playlists" className="back-link">
        ← Playlists
      </Link>
      <div className="playlist-detail-title-row">
        {renamingPlaylist ? (
          <div className="playlist-rename-row">
            <input
              id="playlist-rename-input"
              type="text"
              className="input playlist-title-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={savingPlaylistName}
              autoFocus
              aria-label="Nombre de la playlist"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setRenamingPlaylist(false)
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void savePlaylistName()
                }
              }}
            />
            {savingPlaylistName ? (
              <span className="muted small playlist-title-saving" aria-live="polite">
                Guardando…
              </span>
            ) : null}
          </div>
        ) : (
          <>
            <h1
              className="playlist-title-editable"
              tabIndex={0}
              title="Clic para editar el nombre"
              onClick={() => {
                setNameDraft(playlist.name)
                setRenamingPlaylist(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setNameDraft(playlist.name)
                  setRenamingPlaylist(true)
                }
              }}
            >
              {playlist.name}
            </h1>
            <button
              type="button"
              className="btn primary playlist-play-all-btn"
              disabled={!rows.length}
              onClick={playAll}
              aria-label="Reproducir toda la playlist"
              title="Reproducir todo"
            >
              <IconPlayAll />
            </button>
          </>
        )}
      </div>
      <h2 className="playlist-section-heading">Canciones</h2>
      {rows.length === 0 ? (
        <div className="empty-state">
          <p>Esta playlist está vacía. Añade pistas desde la biblioteca indexada abajo.</p>
        </div>
      ) : (
        <div className="tbl-wrap playlist-temas-tbl-wrap">
          <table className="tbl playlist-temas-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Artista</th>
                <th>Álbum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const persistLocked = reorderBusyIndex !== null || removingIndex !== null
                const rowReorderBusy = reorderBusyIndex === i
                const rowRemoving = removingIndex === i
                return (
                <tr key={`${r.id}-${i}`}>
                  <td>{i + 1}</td>
                  <td className="playlist-temas-col-name" title={r.name}>
                    {r.name}
                  </td>
                  <td className="muted small playlist-temas-col-meta" title={r.artist ?? undefined}>
                    {r.artist?.trim() || '—'}
                  </td>
                  <td className="muted small playlist-temas-col-meta" title={r.album ?? undefined}>
                    {r.album?.trim() || '—'}
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn sm ghost playlist-temas-action-btn"
                      disabled={persistLocked || i === 0}
                      onClick={() => void move(i, -1)}
                      aria-label="Subir"
                      aria-busy={rowReorderBusy}
                    >
                      {rowReorderBusy ? <span className="player-spinner playlist-temas-reorder-spinner" aria-hidden /> : '↑'}
                    </button>
                    <button
                      type="button"
                      className="btn sm ghost playlist-temas-action-btn"
                      disabled={persistLocked || i === rows.length - 1}
                      onClick={() => void move(i, 1)}
                      aria-label="Bajar"
                      aria-busy={rowReorderBusy}
                    >
                      {rowReorderBusy ? <span className="player-spinner playlist-temas-reorder-spinner" aria-hidden /> : '↓'}
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={persistLocked}
                      onClick={() => player.playSingle(rowToTrackRef(r))}
                      aria-label={`Reproducir ${r.name}`}
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      className="btn sm ghost playlist-temas-action-btn playlist-temas-remove-btn"
                      disabled={persistLocked}
                      onClick={() => void removeAt(i)}
                      aria-label={`Quitar ${r.name} de la playlist`}
                      title="Quitar de la playlist"
                      aria-busy={rowRemoving}
                    >
                      {rowRemoving ? (
                        <span className="player-spinner playlist-temas-reorder-spinner" aria-hidden />
                      ) : (
                        <IconTrash />
                      )}
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="playlist-library-picker-heading">Añadir desde la biblioteca</h3>
      <div className="toolbar toolbar-sticky wrap" style={{ marginTop: '0.75rem' }}>
        <input
          type="search"
          className="input"
          placeholder="Buscar por nombre, carpeta, artista o álbum…"
          value={pickerFilter}
          onChange={(e) => setPickerFilter(e.target.value)}
          disabled={indexLoading || indexedTracks.length === 0}
          aria-busy={indexLoading}
        />
      </div>
      {indexLoading && indexLoadProgress ? (
        <p className="muted small library-load-progress" style={{ marginTop: '0.35rem' }} aria-live="polite">
          Cargando índice… {indexLoadProgress}
        </p>
      ) : null}
      {!indexLoading && indexedTracks.length === 0 ? (
        <p className="muted small" style={{ marginTop: '0.35rem' }}>
          No hay pistas indexadas. Escanea una carpeta en el Explorador.
        </p>
      ) : null}
      {!indexLoading && indexedTracks.length > 0 && pickerSorted.length === 0 ? (
        <p className="muted small" style={{ marginTop: '0.35rem' }}>
          Ningún resultado con este filtro.
        </p>
      ) : null}
      {!indexLoading && pickerSorted.length > 0 ? (
        <>
          <div className="library-table-meta muted small" style={{ marginTop: '0.5rem' }}>
            {pickerSorted.length} resultado{pickerSorted.length === 1 ? '' : 's'}
            {pickerRangeLabel ? ` · filas ${pickerRangeLabel}` : ''} · {PICKER_PAGE_SIZE} por página
          </div>
          <div className="tbl-wrap playlist-picker-tbl-wrap">
            <table className="tbl playlist-picker-tbl">
              <thead>
                <tr>
                  <th className="playlist-picker-col-name">Nombre</th>
                  <th className="playlist-picker-col-folder">Carpeta</th>
                  <th>Artista</th>
                  <th>Álbum</th>
                  <th className="playlist-picker-col-actions" />
                </tr>
              </thead>
              <tbody>
                {pickerSlice.map((t) => {
                  const folder = t.folderPath?.trim() || ''
                  const inList = rows.some((r) => r.id === t.id)
                  const addingThis = pickerAddingId === t.id
                  const pickerAddBusy = pickerAddingId !== null
                  return (
                    <tr key={t.id}>
                      <td className="playlist-picker-col-name" title={t.name}>
                        {t.name}
                      </td>
                      <td className="muted small playlist-picker-col-folder" title={folder || undefined}>
                        {folder || '—'}
                      </td>
                      <td title={t.audioArtist ?? undefined}>{t.audioArtist?.trim() || '—'}</td>
                      <td title={t.audioAlbum ?? undefined}>{t.audioAlbum?.trim() || '—'}</td>
                      <td className="playlist-picker-col-actions">
                        <button
                          type="button"
                          className={`btn sm playlist-picker-add-btn${addingThis ? ' playlist-picker-add-btn--busy' : ''}`}
                          disabled={inList || (pickerAddBusy && !addingThis)}
                          aria-busy={addingThis}
                          aria-label={
                            addingThis
                              ? 'Añadiendo a la playlist…'
                              : inList
                                ? 'Ya está en la playlist'
                                : `Añadir ${t.name} a la playlist`
                          }
                          title={inList ? 'Ya en la lista' : addingThis ? 'Añadiendo…' : 'Añadir a la playlist'}
                          onClick={() => void addTrackById(t.id)}
                        >
                          {inList ? 'En lista' : addingThis ? <span className="player-spinner playlist-picker-add-spinner" aria-hidden /> : 'Añadir'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pickerPageCount > 1 ? (
            <nav className="library-pager" aria-label="Paginación del buscador">
              <button
                type="button"
                className="btn sm"
                disabled={safePickerPage <= 0}
                onClick={() => setPickerPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span className="muted small">
                Página {safePickerPage + 1} de {pickerPageCount}
              </span>
              <button
                type="button"
                className="btn sm"
                disabled={safePickerPage >= pickerPageCount - 1}
                onClick={() => setPickerPage((p) => Math.min(pickerPageCount - 1, p + 1))}
              >
                Siguiente
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
