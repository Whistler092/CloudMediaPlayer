import {
  writeBatch,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import { getDriveItem, getDriveItemWithAudioSelect, listDriveChildren } from '../api/graphClient'
import type { GraphDriveItem } from '../api/graphTypes'
import { enrichDriveItemFromId3Range } from './id3FromGraphContent'
import {
  clearScanCheckpoint,
  loadScanCheckpoint,
  saveScanCheckpoint,
  type ScanCheckpoint,
} from './checkpointDb'
import { userLibTrackDoc } from '../firestore/paths'

const AUDIO_EXT = new Set([
  'mp3',
  'flac',
  'm4a',
  'aac',
  'ogg',
  'wav',
  'wma',
  'opus',
  'webm',
])

export function isAudioItem(item: GraphDriveItem): boolean {
  if (item.folder) return false
  const lower = item.name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot + 1) : ''
  if (AUDIO_EXT.has(ext)) return true
  const mime = item.file?.mimeType ?? ''
  return mime.startsWith('audio/')
}

function fileExt(name: string): string {
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  return dot >= 0 ? lower.slice(dot + 1) : ''
}

/** Graph en `/children` a veces manda solo `duration` en `audio`; igual necesitamos GET por ítem para artista/álbum. */
function hasArtistAndAlbum(item: GraphDriveItem): boolean {
  const a = item.audio
  if (!a) return false
  const artist = (a.artist ?? '').trim()
  const album = (a.album ?? '').trim()
  return Boolean(artist && album)
}

function mergeAudioFacet(
  fromList: GraphDriveItem['audio'],
  fromDetail: GraphDriveItem['audio'],
): GraphDriveItem['audio'] | undefined {
  if (!fromList && !fromDetail) return undefined
  const pick = (d?: string | null, b?: string | null) => {
    const ds = (d ?? '').trim()
    const bs = (b ?? '').trim()
    return ds || bs || undefined
  }
  return {
    ...fromList,
    ...fromDetail,
    title: pick(fromDetail?.title, fromList?.title),
    artist: pick(fromDetail?.artist, fromList?.artist),
    album: pick(fromDetail?.album, fromList?.album),
    duration: fromDetail?.duration ?? fromList?.duration,
  }
}

function tailFolderLabel(folderPath: string, maxLen = 56): string {
  const t = folderPath.trim()
  if (t.length <= maxLen) return t
  return `…${t.slice(-(maxLen - 1))}`
}

async function enrichAudioMetadata(
  accessToken: string,
  items: GraphDriveItem[],
  opts: {
    folderPath: string
    pendingFolders: number
    onBatchProgress: (detail: string) => void
  },
): Promise<GraphDriveItem[]> {
  const { folderPath, pendingFolders, onBatchProgress } = opts
  const concurrency = 8
  const out: GraphDriveItem[] = []
  const batchTotal = items.length
  const tail = tailFolderLabel(folderPath)

  for (let i = 0; i < items.length; i += concurrency) {
    const lo = i + 1
    const hi = Math.min(i + concurrency, batchTotal)
    onBatchProgress(
      `Metadatos ${lo}–${hi}/${batchTotal} (en curso) en ${tail} · ${pendingFolders} carp. en cola`,
    )
    const chunk = items.slice(i, i + concurrency)
    const settled = await Promise.all(
      chunk.map(async (item) => {
        if (hasArtistAndAlbum(item)) return item
        try {
          const detail = await getDriveItemWithAudioSelect(accessToken, item.id)
          let merged = mergeAudioFacet(item.audio, detail.audio)
          if (!hasArtistAndAlbum({ ...item, audio: merged })) {
            const full = await getDriveItem(accessToken, item.id)
            merged = mergeAudioFacet(merged, full.audio)
          }
          let result: GraphDriveItem = merged ? { ...item, audio: merged } : item
          if (!hasArtistAndAlbum(result)) {
            result = await enrichDriveItemFromId3Range(accessToken, result)
          }
          return result
        } catch {
          /* Graph falló; el ítem se indexa sin metadatos remotos */
        }
        return item
      }),
    )
    out.push(...settled)
    onBatchProgress(
      `Metadatos ${out.length}/${batchTotal} en ${tail} · ${pendingFolders} carp. en cola`,
    )
  }
  return out
}

export async function scanDriveFolder(opts: {
  getToken: () => Promise<string>
  firestore: Firestore
  firebaseUid: string
  rootFolderId: string
  displayPath: string
  recursive: boolean
  onProgress: (indexed: number, detail: string) => void
  signal: AbortSignal
}): Promise<{ indexedTrackCount: number; elapsedMs: number }> {
  const {
    getToken,
    firestore,
    firebaseUid,
    rootFolderId,
    displayPath,
    recursive,
    onProgress,
    signal,
  } = opts

  const scanT0 = performance.now()
  const elapsedMs = () => Math.round(performance.now() - scanT0)

  const scanKey = `${firebaseUid}:${rootFolderId}`

  const existing = await loadScanCheckpoint(scanKey)
  const canResume =
    existing?.version === 2 &&
    Array.isArray(existing.queue) &&
    existing.queue.length > 0 &&
    existing.queue.every((q) => typeof q.folderPath === 'string')
  const queue: { folderId: string; nextLink?: string; folderPath: string }[] = canResume
    ? existing.queue.map((q) => ({
        folderId: q.folderId,
        nextLink: q.nextLink,
        folderPath: q.folderPath,
      }))
    : [{ folderId: rootFolderId, nextLink: undefined, folderPath: displayPath }]
  let indexedCount = existing?.indexedCount ?? 0

  const flushWrites = async (items: GraphDriveItem[], folderPath: string) => {
    if (items.length === 0) return
    const chunkSize = 400
    for (let i = 0; i < items.length; i += chunkSize) {
      const slice = items.slice(i, i + chunkSize)
      const batch = writeBatch(firestore)
      for (const item of slice) {
        const ext = fileExt(item.name)
        const ref = userLibTrackDoc(firestore, firebaseUid, item.id)
        batch.set(
          ref,
          {
            name: item.name,
            folderPath,
            parentFolderId: item.parentReference?.id ?? null,
            rootId: rootFolderId,
            ext,
            mimeType: item.file?.mimeType ?? null,
            size: item.size ?? null,
            lastModifiedDateTime: item.lastModifiedDateTime ?? null,
            audioTitle: item.audio?.title ?? null,
            audioArtist: item.audio?.artist ?? null,
            audioAlbum: item.audio?.album ?? null,
            audioDurationMs: item.audio?.duration ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      }
      await batch.commit()
    }
  }

  const persistCheckpoint = async (detail: string) => {
    const cp: ScanCheckpoint = {
      version: 2,
      scanKey,
      queue: [...queue],
      indexedCount,
      rootFolderId,
      displayPath,
      recursive,
    }
    await saveScanCheckpoint(cp)
    onProgress(indexedCount, detail)
  }

  /** Solo UI: no escribe checkpoint (evita IndexedDB en cada sublote de 8 pistas). */
  const reportUi = (detail: string) => {
    onProgress(indexedCount, detail)
  }

  try {
    while (queue.length > 0 && !signal.aborted) {
      const head = queue[0]!
      const token = await getToken()
      const page = await listDriveChildren(token, head.folderId, head.nextLink)

      const audioBatch: GraphDriveItem[] = []
      for (const item of page.value) {
        if (signal.aborted) break
        if (item.folder && recursive) {
          queue.push({
            folderId: item.id,
            nextLink: undefined,
            folderPath: `${head.folderPath} / ${item.name}`,
          })
        } else if (isAudioItem(item)) {
          audioBatch.push(item)
        }
      }

      if (audioBatch.length) {
        const enriched = await enrichAudioMetadata(token, audioBatch, {
          folderPath: head.folderPath,
          pendingFolders: queue.length,
          onBatchProgress: (detail) => reportUi(detail),
        })
        await flushWrites(enriched, head.folderPath)
        indexedCount += enriched.length
      } else {
        reportUi(
          `Sin audio en esta página · explorando ${tailFolderLabel(head.folderPath)} · ${queue.length} carp. en cola`,
        )
      }

      if (page['@odata.nextLink']) {
        queue[0] = {
          folderId: head.folderId,
          nextLink: page['@odata.nextLink'],
          folderPath: head.folderPath,
        }
      } else {
        queue.shift()
      }

      await persistCheckpoint(
        queue.length ? `Carpetas pendientes: ${queue.length}` : 'Finalizando…',
      )
    }

    if (signal.aborted) {
      await clearScanCheckpoint(scanKey)
      return { indexedTrackCount: indexedCount, elapsedMs: elapsedMs() }
    }

    await clearScanCheckpoint(scanKey)
    return { indexedTrackCount: indexedCount, elapsedMs: elapsedMs() }
  } catch (e) {
    await clearScanCheckpoint(scanKey)
    throw e
  }
}
