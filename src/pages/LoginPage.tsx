import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { loginRequest } from '../auth/msalInstance'
import { authDebug } from '../debug/msalDebug'
import { BrandLogo } from '../components/BrandLogo'

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
    authDebug('loginRedirect → inicio')
    void instance.loginRedirect(loginRequest)
  }

  return (
    <div className="login-layout">
      <div className="login-page">
        <div className="login-page-heading">
          <BrandLogo size={44} />
          <h1>Cloud Media Player</h1>
        </div>
        <p className="page-lead" style={{ marginTop: 0 }}>
          Inicia sesión con Microsoft para acceder a OneDrive y reproducir tu música.
        </p>
        <button type="button" className="btn primary" onClick={onLogin}>
          Entrar con Microsoft
        </button>
        <details className="details-advanced">
          <summary>Configuración y ayuda</summary>
          <p className="hint small">
            Necesitas <code>VITE_MSAL_CLIENT_ID</code> en <code>.env</code>. Consulta{' '}
            <code>docs/azure-app-setup.md</code> en el repositorio.
          </p>
          {import.meta.env.DEV && (
            <p className="hint small">
              Modo desarrollo: consola (F12) con <code>[AuthDebug]</code> y <code>[MSAL:event]</code>.
            </p>
          )}
        </details>
      </div>
    </div>
  )
}
