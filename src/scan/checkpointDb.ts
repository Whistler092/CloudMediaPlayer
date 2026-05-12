import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const DB_NAME = 'cloud-media-player-scan'
const DB_VERSION = 1

export type ScanCheckpoint = {
  version: 2
  scanKey: string
  queue: { folderId: string; nextLink?: string; folderPath: string }[]
  indexedCount: number
  rootFolderId: string
  displayPath: string
  recursive: boolean
}

interface ScanDb extends DBSchema {
  checkpoints: {
    key: string
    value: ScanCheckpoint
  }
}

export async function openScanDb(): Promise<IDBPDatabase<ScanDb>> {
  return openDB<ScanDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('checkpoints')
    },
  })
}

export async function saveScanCheckpoint(cp: ScanCheckpoint): Promise<void> {
  const db = await openScanDb()
  await db.put('checkpoints', cp, cp.scanKey)
}

export async function loadScanCheckpoint(
  scanKey: string,
): Promise<ScanCheckpoint | undefined> {
  const db = await openScanDb()
  return db.get('checkpoints', scanKey)
}

export async function clearScanCheckpoint(scanKey: string): Promise<void> {
  const db = await openScanDb()
  await db.delete('checkpoints', scanKey)
}

/** Borra checkpoints de escaneo en este dispositivo para un usuario (clave `uid:rootId`). */
export async function clearScanCheckpointsForUser(firebaseUid: string): Promise<void> {
  const db = await openScanDb()
  const prefix = `${firebaseUid}:`
  const keys = await db.getAllKeys('checkpoints')
  for (const key of keys) {
    if (typeof key === 'string' && key.startsWith(prefix)) {
      await db.delete('checkpoints', key)
    }
  }
}
