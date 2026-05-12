import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
  type Auth,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFirebaseConfigOrNull } from '../config/env'

export type FirebaseBundle = {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let bundle: FirebaseBundle | null = null

export function getFirebase(): FirebaseBundle | null {
  if (bundle) return bundle
  const cfg = getFirebaseConfigOrNull()
  if (!cfg) return null
  const app = initializeApp(cfg)
  bundle = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  }
  return bundle
}

export async function ensureAnonymousUser(auth: Auth): Promise<string> {
  if (!auth.currentUser) await signInAnonymously(auth)
  return auth.currentUser!.uid
}
