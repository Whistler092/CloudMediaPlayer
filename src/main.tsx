import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import App from './App.tsx'
import { getMsalInstance } from './auth/msalInstance'
import { getMsalClientId } from './config/env'
import { MissingMsalConfig } from './MissingMsalConfig.tsx'
import { authDebug, registerMsalDevLogging } from './debug/msalDebug'

async function bootstrap() {
  const el = document.getElementById('root')!
  if (!getMsalClientId()) {
    createRoot(el).render(
      <StrictMode>
        <MissingMsalConfig />
      </StrictMode>,
    )
    return
  }

  // MSAL v5 + loginPopup / acquireTokenPopup: el popup vuelve al redirectUri con #code=…&state=…
  // Hay que reenviar al opener por BroadcastChannel. Sin eso, esta ventana monta la SPA y
  // handleRedirectPromise falla (sessionStorage del popup ≠ del opener).
  // Algunos navegadores dejan window.opener en null (p. ej. COOP); MSAL asigna window.name "msal…".
  if (typeof window !== 'undefined') {
    const hasOAuthState =
      window.location.hash.includes('state=') || window.location.search.includes('state=')
    const looksLikeMsalPopup = Boolean(window.opener) || window.name.startsWith('msal.')
    if (hasOAuthState && looksLikeMsalPopup) {
      try {
        const { broadcastResponseToMainFrame } = await import('@azure/msal-browser/redirect-bridge')
        await broadcastResponseToMainFrame()
        authDebug('redirect-bridge: respuesta OAuth enviada al opener; esta ventana debería cerrarse')
        return
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[MSAL] redirect-bridge no aplicó (seguimos con bootstrap normal):', e)
        }
      }
    }
  }

  const pca = getMsalInstance()
  await pca.initialize()
  registerMsalDevLogging(pca)

  try {
    const redirectResult = await pca.handleRedirectPromise()
    authDebug('handleRedirectPromise resultado', redirectResult?.account?.username ?? null)
    if (redirectResult?.account) {
      pca.setActiveAccount(redirectResult.account)
    }
  } catch (e) {
    console.warn('[MSAL] handleRedirectPromise:', e)
  }

  authDebug('cuentas en caché tras bootstrap', {
    count: pca.getAllAccounts().length,
    usernames: pca.getAllAccounts().map((a) => a.username),
    active: pca.getActiveAccount()?.username ?? null,
  })

  // Si el IdP devolvió error en el fragment (#error=...) y no hay flujo redirect válido en caché,
  // MSAL puede lanzar no_token_request_cache_error; además el hash deja la app en estado roto al recargar.
  if (window.location.hash && window.location.hash.includes('error=')) {
    const q = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const err = q.get('error')
    const desc = q.get('error_description')
    if (err) {
      console.warn('[MSAL] Error en URL del IdP:', err, desc ?? '(sin descripción)')
    }
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
  }

  createRoot(el).render(
    <StrictMode>
      <MsalProvider instance={pca}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </StrictMode>,
  )
}

void bootstrap()
