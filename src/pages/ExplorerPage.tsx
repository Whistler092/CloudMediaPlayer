import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function formatScanDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

function ExplorerTableSkeleton() {
  return (
    <div className="tbl-wrap" aria-busy="true" aria-label="Cargando carpeta">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-line skeleton-block" />
          <div className="skeleton-line skeleton-block short" />
        </div>
      ))}
    </div>
  )
}

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
  const [explorerFilter, setExplorerFilter] = useState('')
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

  useEffect(() => {
    setExplorerFilter('')
  }, [folderId])

  const filteredItems = useMemo(() => {
    const q = explorerFilter.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const name = it.name.toLowerCase()
      const mime = (it.file?.mimeType ?? '').toLowerCase()
      return name.includes(q) || mime.includes(q)
    })
  }, [items, explorerFilter])

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
    const scanWall0 = performance.now()
    try {
      const { indexedTrackCount, elapsedMs } = await scanDriveFolder({
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
        lastScanDurationMs: elapsedMs,
      })
      setScanMsg(
        `${indexedTrackCount} pistas — ${aborted ? 'cancelado' : 'listo'} en ${formatScanDuration(elapsedMs)}`,
      )
    } catch (e) {
      await updateDoc(rootRef, {
        scanStatus: 'error',
        errorMessage: e instanceof Error ? e.message : 'Error desconocido',
        lastScanCompletedAt: serverTimestamp(),
        lastScanDurationMs: Math.round(performance.now() - scanWall0),
      })
    } finally {
      setScanning(false)
    }
  }

  const canFirebase = isFirebaseConfigured() && firebaseReady && firebaseUid && fb

  return (
    <div className="page explorer">
      <h1>Explorador</h1>
      <p className="page-lead">Navega por OneDrive, reproduce al vuelo o indexa carpetas para tu biblioteca.</p>
      <nav className="breadcrumb breadcrumb--retro" aria-label="Ruta">
        {breadcrumb.map((c, i) => (
          <span key={c.id}>
            {i > 0 ? <span className="bc-sep"> / </span> : null}
            <button type="button" className="linkish" onClick={() => goCrumb(i)}>
              {c.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="scan-panel">
        <div className="toolbar" style={{ marginTop: 0 }}>
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
          <p className="hint" style={{ marginBottom: 0 }}>
            Conecta Firebase y espera la autenticación anónima para indexar.
          </p>
        )}
      </div>

      <div className="explorer-search">
        <input
          type="search"
          className="input explorer-search-input"
          placeholder="Buscar en esta carpeta por nombre…"
          value={explorerFilter}
          onChange={(e) => setExplorerFilter(e.target.value)}
          aria-label="Filtrar por nombre o tipo (MIME)"
          autoComplete="off"
        />
        {explorerFilter.trim() && items.length > 0 ? (
          <p className="muted small explorer-search-meta">
            {filteredItems.length} de {items.length} visibles
          </p>
        ) : null}
      </div>

      {loading && <ExplorerTableSkeleton />}
      {!loading && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <h2>Carpeta vacía</h2>
          <p>No hay elementos en esta ubicación.</p>
        </div>
      )}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔎</div>
          <h2>Sin coincidencias</h2>
          <p>Ningún nombre coincide con «{explorerFilter.trim()}». Prueba otra búsqueda o pulsa «Cargar más» si faltan elementos por paginar.</p>
        </div>
      )}
      {!loading && filteredItems.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id} className={it.folder ? 'row-folder' : undefined}>
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
        </div>
      )}
      {nextLink && (
        <button type="button" className="btn" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? 'Cargando…' : 'Cargar más en esta carpeta'}
        </button>
      )}
    </div>
  )
}
