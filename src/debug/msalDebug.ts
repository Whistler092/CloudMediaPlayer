import type { PublicClientApplication } from '@azure/msal-browser'
import { EventType } from '@azure/msal-browser'

const interesting = new Set<string>([
  EventType.LOGIN_SUCCESS,
  EventType.LOGOUT_SUCCESS,
  EventType.LOGOUT_FAILURE,
  EventType.ACQUIRE_TOKEN_SUCCESS,
  EventType.ACQUIRE_TOKEN_FAILURE,
  EventType.HANDLE_REDIRECT_START,
  EventType.HANDLE_REDIRECT_END,
  EventType.POPUP_OPENED,
])

/**
 * En desarrollo, escribe eventos MSAL en consola para depurar login / tokens.
 */
export function registerMsalDevLogging(pca: PublicClientApplication): void {
  if (!import.meta.env.DEV) return

  pca.addEventCallback((msg) => {
    if (!interesting.has(msg.eventType)) return
    const payload: Record<string, unknown> = { eventType: msg.eventType }
    if (msg.error) payload.error = msg.error.message
    if (msg.payload) payload.payload = msg.payload
    const level = msg.eventType.endsWith('FAILURE') ? 'warn' : 'info'
    console[level]('[MSAL:event]', payload)
  })
}

export const authDebug = (label: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.info(`[AuthDebug] ${label}`, data ?? '')
  }
}
