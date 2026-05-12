export function getMsalClientId(): string | undefined {
  return import.meta.env.VITE_MSAL_CLIENT_ID as string | undefined
}

export function getMsalTenantId(): string {
  return (import.meta.env.VITE_MSAL_TENANT_ID as string | undefined) || 'common'
}

export function getFirebaseConfigOrNull():
  | {
      apiKey: string
      authDomain: string
      projectId: string
      storageBucket?: string
      messagingSenderId?: string
      appId?: string
    }
  | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined
  if (!apiKey || !authDomain || !projectId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  }
}

export const isFirebaseConfigured = (): boolean => getFirebaseConfigOrNull() !== null
