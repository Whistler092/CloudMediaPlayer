import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { getFirebase } from '../lib/firebase'
import { useFirebaseUser } from '../hooks/useFirebaseUser'
import { isFirebaseConfigured } from '../config/env'
import { userPlaylistsCol } from '../firestore/paths'
import type { PlaylistDoc } from '../types/firestore'

export function PlaylistsPage() {
  const { firebaseUid, firebaseReady } = useFirebaseUser()
  const fb = getFirebase()
  const [items, setItems] = useState<{ id: string; data: PlaylistDoc }[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!fb || !firebaseUid) return
    const q = query(userPlaylistsCol(fb.db, firebaseUid), orderBy('updatedAt', 'desc'))
    const snap = await getDocs(q)
    setItems(snap.docs.map((d) => ({ id: d.id, data: d.data() as PlaylistDoc })))
  }, [fb, firebaseUid])

  useEffect(() => {
    if (!fb || !firebaseUid || !firebaseReady) {
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
  }, [fb, firebaseUid, firebaseReady, load])

  const create = async () => {
    if (!fb || !firebaseUid || !name.trim()) return
    await addDoc(userPlaylistsCol(fb.db, firebaseUid), {
      name: name.trim(),
      orderedTrackIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setName('')
    await load()
  }

  const remove = async (id: string) => {
    if (!fb || !firebaseUid) return
    if (!confirm('¿Eliminar esta playlist?')) return
    await deleteDoc(doc(fb.db, 'users', firebaseUid, 'playlists', id))
    await load()
  }

  if (!isFirebaseConfigured()) {
    return <p className="hint">Configura Firebase para usar playlists.</p>
  }
  if (!firebaseReady || !firebaseUid) {
    return <p className="hint">Esperando autenticación Firebase…</p>
  }

  return (
    <div className="page playlists">
      <h1>Playlists</h1>
      <div className="toolbar">
        <input
          className="input"
          placeholder="Nombre de la nueva playlist"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="btn primary" disabled={!name.trim()} onClick={() => void create()}>
          Crear
        </button>
      </div>
      {loading && <p>Cargando…</p>}
      <ul className="plist">
        {items.map((p) => (
          <li key={p.id} className="plist-row">
            <Link to={`/playlists/${p.id}`}>{p.data.name}</Link>
            <span className="muted">{p.data.orderedTrackIds.length} temas</span>
            <button type="button" className="btn sm ghost" onClick={() => void remove(p.id)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
