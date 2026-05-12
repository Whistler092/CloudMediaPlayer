import {
  writeBatch,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import { listDriveChildren } from '../api/graphClient'
import type { GraphDriveItem } from '../api/graphTypes'
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

export async function scanDriveFolder(opts: {
  getToken: () => Promise<string>
  firestore: Firestore
  firebaseUid: string
  rootFolderId: string
  displayPath: string
  recursive: boolean
  onProgress: (indexed: number, detail: string) => void
  signal: AbortSignal
}): Promise<{ indexedTrackCount: number }> {
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
        await flushWrites(audioBatch, head.folderPath)
        indexedCount += audioBatch.length
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
      return { indexedTrackCount: indexedCount }
    }

    await clearScanCheckpoint(scanKey)
    return { indexedTrackCount: indexedCount }
  } catch (e) {
    await clearScanCheckpoint(scanKey)
    throw e
  }
}