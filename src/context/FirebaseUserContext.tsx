/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useIsAuthenticated } from '@azure/msal-react'
import { getFirebase, ensureAnonymousUser } from '../lib/firebase'
import { isFirebaseConfigured } from '../config/env'

export type FirebaseUserState = {
  firebaseUid: string | null
  firebaseReady: boolean
}

export const FirebaseUserContext = createContext<FirebaseUserState>({
  firebaseUid: null,
  firebaseReady: false,
})

export function FirebaseUserProvider({ children }: { children: ReactNode }) {
  const isMsal = useIsAuthenticated()
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null)
  const [firebaseReady, setFirebaseReady] = useState(false)

  const run = useCallback(async () => {
    if (!isMsal || !isFirebaseConfigured()) {
      setFirebaseUid(null)
      setFirebaseReady(true)
      return
    }
    const bundle = getFirebase()
    if (!bundle) {
      setFirebaseUid(null)
      setFirebaseReady(true)
      return
    }
    try {
      const uid = await ensureAnonymousUser(bundle.auth)
      setFirebaseUid(uid)
    } catch {
      setFirebaseUid(null)
    } finally {
      setFirebaseReady(true)
    }
  }, [isMsal])

  useEffect(() => {
    queueMicrotask(() => {
      void run()
    })
  }, [run])

  const value = useMemo(
    () => ({ firebaseUid, firebaseReady }),
    [firebaseUid, firebaseReady],
  )

  return (
    <FirebaseUserContext.Provider value={value}>
      {children}
    </FirebaseUserContext.Provider>
  )
}
