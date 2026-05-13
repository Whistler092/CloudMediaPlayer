import {
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type Firestore,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore'
import { userLibTracksCol } from '../firestore/paths'
import type { LibraryTrackDoc } from '../types/firestore'

export type IndexedTrackRow = LibraryTrackDoc & { id: string }

const FIRESTORE_PAGE = 500

/** Misma lógica que la biblioteca (sin coincidencia por id de documento). */
export function filterIndexedTracks(rows: IndexedTrackRow[], filter: string): IndexedTrackRow[] {
  const f = filter.trim().toLowerCase()
  if (!f) return rows
  return rows.filter((t) => {
    const folder = (t.folderPath ?? '').toLowerCase()
    return (
      t.name.toLowerCase().includes(f) ||
      folder.includes(f) ||
      (t.audioArtist && t.audioArtist.toLowerCase().includes(f)) ||
      (t.audioAlbum && t.audioAlbum.toLowerCase().includes(f))
    )
  })
}

export async function loadAllIndexedTracks(
  db: Firestore,
  uid: string,
  onProgress?: (count: number) => void,
): Promise<IndexedTrackRow[]> {
  const all: IndexedTrackRow[] = []
  let last: QueryDocumentSnapshot | null = null
  const col = userLibTracksCol(db, uid)
  while (true) {
    const snap: QuerySnapshot = await getDocs(
      last
        ? query(col, orderBy('name'), startAfter(last), limit(FIRESTORE_PAGE))
        : query(col, orderBy('name'), limit(FIRESTORE_PAGE)),
    )
    if (snap.empty) break
    for (const d of snap.docs) {
      all.push({ ...(d.data() as LibraryTrackDoc), id: d.id })
    }
    onProgress?.(all.length)
    last = snap.docs[snap.docs.length - 1]!
    if (snap.docs.length < FIRESTORE_PAGE) break
  }
  return all
}
