import { LogLevel, PublicClientApplication } from '@azure/msal-browser'
import { getMsalClientId, getMsalTenantId } from '../config/env'

const redirectUri =
  typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:5173/'

let instance: PublicClientApplication | null = null

export function getMsalInstance(): PublicClientApplication {
  const clientId = getMsalClientId()
  if (!clientId) {
    throw new Error('Configura VITE_MSAL_CLIENT_ID en .env (ver docs/azure-app-setup.md)')
  }
  if (!instance) {
    instance = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${getMsalTenantId()}`,
        redirectUri,
        postLogoutRedirectUri: redirectUri,
      },
      cache: { cacheLocation: 'localStorage' },
      system: {
        loggerOptions: {
          logLevel: import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error,
        },
      },
    })
  }
  return instance
}

export const graphScopes = ['User.Read', 'Files.Read', 'offline_access'] as const

export const loginRequest = { scopes: [...graphScopes] }
