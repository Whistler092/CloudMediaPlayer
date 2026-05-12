import { getDocs, limit, query, writeBatch, type Firestore } from 'firebase/firestore'
import { userLibRootsCol, userLibTracksCol } from '../firestore/paths'
import { clearScanCheckpointsForUser } from '../scan/checkpointDb'

const CHUNK = 400

async function deleteAllDocsInCollection(db: Firestore, col: ReturnType<typeof userLibTracksCol>) {
  for (;;) {
    const snap = await getDocs(query(col, limit(CHUNK)))
    if (snap.empty) break
    const batch = writeBatch(db)
    for (const d of snap.docs) {
      batch.delete(d.ref)
    }
    await batch.commit()
  }
}

/** Elimina todos los documentos de índice (pistas + raíces) y checkpoints de escaneo locales. No borra playlists. */
export async function clearIndexedLibrary(db: Firestore, firebaseUid: string): Promise<void> {
  await deleteAllDocsInCollection(db, userLibTracksCol(db, firebaseUid))
  await deleteAllDocsInCollection(db, userLibRootsCol(db, firebaseUid))
  await clearScanCheckpointsForUser(firebaseUid)
}
