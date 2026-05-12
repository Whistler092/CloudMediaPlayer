import { useCallback, useEffect, useRef, useState } from 'react'
import {
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { getDriveRoot, listDriveChildren } from '../api/graphClient'
import type { GraphDriveItem } from '../api/graphTypes'
import { useGraphAccessToken } from '../hooks/useGraphAccessToken'
import { useFirebaseUser } from '../hooks/useFirebaseUser'
import { getFirebase } from '../lib/firebase'
import { isFirebaseConfigured } from '../config/env'
import { userLibRootDoc } from '../firestore/paths'
import { scanDriveFolder, isAudioItem } from '../scan/scanDriveFolder'
import { clearScanCheckpoint } from '../scan/checkpointDb'
import { usePlayer } from '../player/PlayerContext'
import type { PlayerTrackRef } from '../types/player'

type Crumb = { id: string; name: string }

export function ExplorerPage() {
  const acquireToken = useGraphAccessToken()
  const { firebaseUid, firebaseReady } = useFirebaseUser()
  const player = usePlayer()
  const fb = getFirebase()

  const [folderId, setFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([])
  const [items, setItems] = useState<GraphDriveItem[]>([])
  const [nextLink, setNextLink] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [recursiveScan, setRecursiveScan] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      const token = await acquireToken()
      const root = await getDriveRoot(token)
      if (c) return
      setFolderId(root.id)
      setBreadcrumb([{ id: root.id, name: 'OneDrive' }])
    })()
    return () => {
      c = true
    }
  }, [acquireToken])

  useEffect(() => {
    if (!folderId) return
    let c = false
    ;(async () => {
      setLoading(true)
      setItems([])
      setNextLink(undefined)
      const token = await acquireToken()
      const data = await listDriveChildren(token, folderId)
      if (c) return
      setItems(data.value)
      setNextLink(data['@odata.nextLink'])
      setLoading(false)
    })()
    return () => {
      c = true
    }
  }, [folderId, acquireToken])

  const loadMore = useCallback(async () => {
    if (!folderId || !nextLink) return
    setLoadingMore(true)
    const token = await acquireToken()
    const data = await listDriveChildren(token, folderId, nextLink)
    setItems((prev) => [...prev, ...data.value])
    setNextLink(data['@odata.nextLink'])
    setLoadingMore(false)
  }, [folderId, nextLink, acquireToken])

  const enterFolder = (item: GraphDriveItem) => {
    if (!item.folder) return
    setFolderId(item.id)
    setBreadcrumb((b) => [...b, { id: item.id, name: item.name }])
  }

  const goCrumb = (index: number) => {
    const c = breadcrumb[index]
    if (!c) return
    setFolderId(c.id)
    setBreadcrumb((b) => b.slice(0, index + 1))
  }

  const toTrackRef = (item: GraphDriveItem): PlayerTrackRef => ({
    id: item.id,
    name: item.name,
    artist: item.audio?.artist,
    album: item.audio?.album,
  })

  const stopScan = () => {
    abortRef.current?.abort()
  }

  const startScan = async () => {
    if (!fb || !firebaseUid || !folderId) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const scanKey = `${firebaseUid}:${folderId}`
    await clearScanCheckpoint(scanKey)
    const rootRef = userLibRootDoc(fb.db, firebaseUid, folderId)
    const pathLabel = breadcrumb.map((x) => x.name).join(' / ')
    setScanning(true)
    setScanMsg('Iniciando…')
    await setDoc(
      rootRef,
      {
        folderDriveItemId: folderId,
        displayPath: pathLabel,
        recursive: recursiveScan,
        scanStatus: 'running',
        indexedTrackCount: 0,
        lastScanStartedAt: serverTimestamp(),
        errorMessage: null,
      },
      { merge: true },
    )
    const ac = abortRef.current!
    try {
      const { indexedTrackCount } = await scanDriveFolder({
        getToken: acquireToken,
        firestore: fb.db,
        firebaseUid,
        rootFolderId: folderId,
        displayPath: pathLabel,
        recursive: recursiveScan,
        onProgress: (n, d) => setScanMsg(`${n} pistas — ${d}`),
        signal: ac.signal,
      })
      const aborted = ac.signal.aborted
      await updateDoc(rootRef, {
        scanStatus: aborted ? 'cancelled' : 'completed',
        indexedTrackCount,
        lastScanCompletedAt: serverTimestamp(),
      })
    } catch (e) {
      await updateDoc(rootRef, {
        scanStatus: 'error',
        errorMessage: e instanceof Error ? e.message : 'Error desconocido',
        lastScanCompletedAt: serverTimestamp(),
      })
    } finally {
      setScanning(false)
    }
  }

  const canFirebase = isFirebaseConfigured() && firebaseReady && firebaseUid && fb

  return (
    <div className="page explorer">
      <h1>Explorador OneDrive</h1>
      <nav className="breadcrumb" aria-label="Ruta">
        {breadcrumb.map((c, i) => (
          <span key={c.id}>
            {i > 0 ? <span className="bc-sep"> / </span> : null}
            <button type="button" className="linkish" onClick={() => goCrumb(i)}>
              {c.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={recursiveScan}
            onChange={(e) => setRecursiveScan(e.target.checked)}
            disabled={scanning}
          />
          Incluir subcarpetas al escanear
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={!canFirebase || scanning || !folderId}
          onClick={() => void startScan()}
        >
          Escanear esta carpeta
        </button>
        {scanning && (
          <button type="button" className="btn ghost" onClick={stopScan}>
            Cancelar escaneo
          </button>
        )}
      </div>
      {scanning && <p className="status">{scanMsg}</p>}
      {!canFirebase && (
        <p className="hint">Conecta Firebase y espera la autenticación anónima para indexar.</p>
      )}

      {loading && <p>Cargando…</p>}
      {!loading && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  {it.folder ? (
                    <button type="button" className="linkish" onClick={() => enterFolder(it)}>
                      {it.name}
                    </button>
                  ) : (
                    it.name
                  )}
                </td>
                <td>{it.folder ? 'Carpeta' : it.file?.mimeType ?? 'Archivo'}</td>
                <td className="actions">
                  {isAudioItem(it) && (
                    <>
                      <button type="button" className="btn sm" onClick={() => player.playSingle(toTrackRef(it))}>
                        Reproducir
                      </button>
                      <button type="button" className="btn sm ghost" onClick={() => player.enqueue(toTrackRef(it))}>
                        Cola
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {nextLink && (
        <button type="button" className="btn" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? 'Cargando…' : 'Cargar más en esta carpeta'}
        </button>
      )}
    </div>
  )
}
