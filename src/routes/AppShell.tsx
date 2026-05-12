import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { PlayerProvider } from '../player/PlayerContext'
import { PlayerBar } from '../components/PlayerBar'
import { isFirebaseConfigured } from '../config/env'
import { authDebug } from '../debug/msalDebug'

export function ProtectedMsal() {
  const isAuthenticated = useIsAuthenticated()
  const { accounts, instance } = useMsal()
  const loc = useLocation()

  useEffect(() => {
    authDebug('ProtectedMsal', {
      isAuthenticated,
      path: loc.pathname,
      accounts: accounts.map((a) => a.username),
      active: instance.getActiveAccount()?.username ?? null,
    })
  }, [isAuthenticated, loc.pathname, accounts, instance])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return <Outlet />
}

export function AppShell() {
  const { instance } = useMsal()
  const loc = useLocation()

  const logout = () => {
    void instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin,
    })
  }

  const nav = (to: string, label: string, prefix?: string) => {
    const p = prefix ?? to
    const active = loc.pathname === to || loc.pathname.startsWith(`${p}/`) || loc.pathname === p
    return (
      <Link to={to} className={active ? 'nav active' : 'nav'}>
        {label}
      </Link>
    )
  }

  return (
    <PlayerProvider>
      <div className="app-root">
        <header className="topbar">
          <Link to="/explorer" className="brand">
            Cloud Media
          </Link>
          <nav className="nav-row">
            {nav('/explorer', 'Explorador')}
            {nav('/library', 'Biblioteca')}
            {nav('/playlists', 'Playlists', '/playlists')}
          </nav>
          <button type="button" className="btn ghost" onClick={() => logout()}>
            Cerrar sesión Microsoft
          </button>
        </header>
        {!isFirebaseConfigured() && (
          <div className="banner warn">
            Falta configuración Firebase en <code>.env</code> (VITE_FIREBASE_*). La biblioteca indexada y
            playlists no estarán disponibles.
          </div>
        )}
        <main className="main">
          <Outlet />
        </main>
        <PlayerBar />
      </div>
    </PlayerProvider>
  )
}
