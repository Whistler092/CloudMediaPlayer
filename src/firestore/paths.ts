import { collection, doc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

export function userLibRootsCol(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'libraryRoots')
}

export function userLibRootDoc(db: Firestore, uid: string, rootId: string) {
  return doc(db, 'users', uid, 'libraryRoots', rootId)
}

export function userLibTracksCol(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'libraryTracks')
}

export function userLibTrackDoc(db: Firestore, uid: string, driveItemId: string) {
  return doc(db, 'users', uid, 'libraryTracks', driveItemId)
}

export function userPlaylistsCol(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'playlists')
}

export function userPlaylistDoc(db: Firestore, uid: string, playlistId: string) {
  return doc(db, 'users', uid, 'playlists', playlistId)
}
