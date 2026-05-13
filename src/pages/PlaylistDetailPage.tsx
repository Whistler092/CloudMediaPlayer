import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getFirebase } from '../lib/firebase'
import { useFirebaseUser } from '../hooks/useFirebaseUser'
import { userLibTrackDoc, userPlaylistDoc } from '../firestore/paths'
import type { LibraryTrackDoc, PlaylistDoc } from '../types/firestore'
import { usePlayer } from '../player/PlayerContext'
import type { PlayerTrackRef } from '../types/player'

type Row = { id: string; name: string }

function PlaylistDetailSkeleton() {
  return (
    <div className="page playlist-detail" aria-busy="true" aria-label="Cargando playlist">
      <div className="skeleton-line skeleton-block short" style={{ marginBottom: '1rem' }} />
      <div className="skeleton-line skeleton-block" style={{ maxWidth: 240, height: 28, marginBottom: '1.5rem' }} />
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
  const [newId, setNewId] = useState('')
  const [loading, setLoading] = useState(true)

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
        resolved.push({ id, name: t.name })
      } else {
        resolved.push({ id, name: id })
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

  const persistIds = async (nextIds: string[]) => {
    if (!fb || !firebaseUid || !playlistId) return
    await updateDoc(userPlaylistDoc(fb.db, firebaseUid, playlistId), {
      orderedTrackIds: nextIds,
      updatedAt: serverTimestamp(),
    })
    await load()
  }

  const move = (index: number, dir: -1 | 1) => {
    const ids = rows.map((r) => r.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const copy = [...ids]
    const t = copy[index]!
    copy[index] = copy[j]!
    copy[j] = t
    void persistIds(copy)
  }

  const removeAt = (index: number) => {
    const ids = rows.map((r) => r.id)
    ids.splice(index, 1)
    void persistIds(ids)
  }

  const addTrack = () => {
    const id = newId.trim()
    if (!id) return
    const ids = rows.map((r) => r.id)
    ids.push(id)
    void persistIds(ids)
    setNewId('')
  }

  const playAll = () => {
    const refs: PlayerTrackRef[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
    }))
    player.playQueue(refs, 0)
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
      <h1>{playlist.name}</h1>
      <p className="page-lead">Ordena los temas o reproduce la lista completa.</p>
      <div className="toolbar">
        <button type="button" className="btn primary" disabled={!rows.length} onClick={playAll}>
          Reproducir todo
        </button>
      </div>
      <h2 style={{ fontSize: '1.05rem', marginTop: '1.5rem' }}>Temas</h2>
      {rows.length === 0 ? (
        <div className="empty-state">
          <p>Esta playlist está vacía. Añade ids de OneDrive abajo o desde la biblioteca.</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre / id OneDrive</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.id}-${i}`}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td className="actions">
                    <button type="button" className="btn sm ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn sm ghost"
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Bajar"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => player.playSingle({ id: r.id, name: r.name })}
                      aria-label={`Reproducir ${r.name}`}
                    >
                      ▶
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => removeAt(i)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3 style={{ fontSize: '1rem', marginTop: '2rem' }}>Añadir por id de OneDrive</h3>
      <p className="muted small">
        Copia el id del archivo desde la biblioteca indexada o Graph. El nombre se resuelve si ya está indexado.
      </p>
      <div className="toolbar wrap">
        <input className="input" placeholder="driveItemId" value={newId} onChange={(e) => setNewId(e.target.value)} />
        <button type="button" className="btn" onClick={addTrack}>
          Añadir
        </button>
      </div>
    </div>
  )
}
