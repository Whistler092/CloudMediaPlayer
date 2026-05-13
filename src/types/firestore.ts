import type { Timestamp } from 'firebase/firestore'

export type ScanStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled'

export type LibraryRootDoc = {
  folderDriveItemId: string
  displayPath: string
  recursive: boolean
  scanStatus: ScanStatus
  indexedTrackCount: number
  lastScanStartedAt?: Timestamp
  lastScanCompletedAt?: Timestamp
  /** Duración del último `scanDriveFolder` (ms), medida en el cliente. */
  lastScanDurationMs?: number
  errorMessage?: string
}

export type LibraryTrackDoc = {
  name: string
  /** Ruta legible de la carpeta que contiene el archivo (mismo estilo que el breadcrumb del escaneo). */
  folderPath?: string | null
  parentFolderId: string | null
  rootId: string
  ext: string
  mimeType?: string | null
  size?: number | null
  lastModifiedDateTime?: string | null
  audioTitle?: string | null
  audioArtist?: string | null
  audioAlbum?: string | null
  audioDurationMs?: number | null
  /** Última escritura en índice (p. ej. escaneo); usado para “recientes”. */
  updatedAt?: Timestamp
}

export type PlaylistDoc = {
  name: string
  orderedTrackIds: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
