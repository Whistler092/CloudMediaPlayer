import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { loginRequest } from '../auth/msalInstance'
import { authDebug } from '../debug/msalDebug'

export function LoginPage() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const navigate = useNavigate()

  useEffect(() => {
    authDebug('LoginPage estado', {
      isAuthenticated,
      accounts: accounts.map((a) => a.username),
      active: instance.getActiveAccount()?.username ?? null,
    })
  }, [isAuthenticated, accounts, instance])

  useEffect(() => {
    if (isAuthenticated) navigate('/explorer', { replace: true })
  }, [isAuthenticated, navigate])

  const onLogin = () => {
    // loginRedirect evita el puente popup/BroadcastChannel (más fiable en Edge y con COOP).
    // Tras volver de Microsoft, handleRedirectPromise en main.tsx completa el flujo en la misma pestaña.
    authDebug('loginRedirect → inicio')
    void instance.loginRedirect(loginRequest)
  }

  return (
    <div className="login-page">
      <h1>Cloud Media Player</h1>
      <p>Inicia sesión con Microsoft para acceder a OneDrive y reproducir tu música.</p>
      <button type="button" className="btn primary" onClick={onLogin}>
        Entrar con Microsoft
      </button>
      <p className="hint">
        Necesitas <code>VITE_MSAL_CLIENT_ID</code> en <code>.env</code>. Consulta{' '}
        <code>docs/azure-app-setup.md</code> en el repositorio.
      </p>
      {import.meta.env.DEV && (
        <p className="hint small">
          Modo desarrollo: mira la consola del navegador (F12) para mensajes <code>[AuthDebug]</code> y{' '}
          <code>[MSAL:event]</code>.
        </p>
      )}
    </div>
  )
}
