import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { PlayerProvider } from '../player/PlayerContext'
import { usePlayer } from '../player/PlayerContext'
import { BrandLogo } from '../components/BrandLogo'
import { PlayerBar } from '../components/PlayerBar'
import { MobileQueueTrigger, PlayerQueuePanel } from '../components/PlayerQueuePanel'
import { useIsMobile } from '../hooks/useIsMobile'
import { isFirebaseConfigured } from '../config/env'
import { authDebug } from '../debug/msalDebug'

function IconExplorer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}
function IconLibrary() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  )
}
function IconPlaylists() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function IconChevronDoubleLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 18l-6-6 6-6M18 18l-6-6 6-6" />
    </svg>
  )
}

function IconChevronDoubleRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M13 18l6-6-6-6M6 18l6-6-6-6" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

const LS_SIDEBAR_COLLAPSED = 'sidebarNavCollapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(LS_SIDEBAR_COLLAPSED) === '1'
  } catch {
    return false
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(LS_SIDEBAR_COLLAPSED, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

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

function AppShellChrome() {
  const { instance, accounts } = useMsal()
  const loc = useLocation()
  const p = usePlayer()
  const hasPlayer = p.queue.length > 0 || !!p.currentTrack
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false)
  const [sidebarNavCollapsed, setSidebarNavCollapsed] = useState(() => readSidebarCollapsed())
  const showBottomPlayerBar = hasPlayer && isMobile && !mobileQueueOpen

  const setSidebarCollapsedPersist = useCallback((collapsed: boolean) => {
    setSidebarNavCollapsed(collapsed)
    writeSidebarCollapsed(collapsed)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    queueMicrotask(() => {
      setSidebarOpen(false)
    })
  }, [isMobile])

  const logout = () => {
    void instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin,
    })
  }

  const nav = (to: string, label: string, icon: ReactNode, prefix?: string) => {
    const pref = prefix ?? to
    const active =
      loc.pathname === to || loc.pathname.startsWith(`${pref}/`) || loc.pathname === pref
    return (
      <Link
        to={to}
        className={active ? 'nav-item active' : 'nav-item'}
        onClick={() => setSidebarOpen(false)}
      >
        {icon}
        <span className="nav-item-label">{label}</span>
      </Link>
    )
  }

  const accountLabel =
    instance.getActiveAccount()?.username ?? accounts[0]?.username ?? ''

  return (
    <div
      className={['app-root', showBottomPlayerBar ? 'app-root--player-bar' : ''].filter(Boolean).join(' ')}
    >
      <div className="app-body">
        <aside
          id="sidebar-main"
          className={[
            'sidebar',
            sidebarOpen ? 'sidebar--open' : '',
            !isMobile && sidebarNavCollapsed ? 'sidebar--collapsed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Navegación principal"
        >
          <div className="sidebar-brand">
            {!isMobile ? (
              <button
                type="button"
                className="btn-icon sidebar-collapse-toggle"
                onClick={() => setSidebarCollapsedPersist(!sidebarNavCollapsed)}
                aria-expanded={!sidebarNavCollapsed}
                aria-controls="sidebar-main-nav"
                title={sidebarNavCollapsed ? 'Expandir menú' : 'Contraer menú'}
              >
                {sidebarNavCollapsed ? <IconChevronDoubleRight /> : <IconChevronDoubleLeft />}
              </button>
            ) : null}
            <Link to="/explorer" className="brand" onClick={() => setSidebarOpen(false)}>
              <BrandLogo
                size={!isMobile && sidebarNavCollapsed ? 32 : 30}
                className="sidebar-brand-logo"
              />
              <span className="sidebar-brand-text">Cloud Media Player</span>
              <span className="sidebar-brand-short">CM</span>
            </Link>
          </div>
          <nav id="sidebar-main-nav" className="sidebar-nav" aria-label="Secciones">
            {nav('/explorer', 'Explorador', <IconExplorer />)}
            {nav('/library', 'Biblioteca', <IconLibrary />)}
            {nav('/playlists', 'Playlists', <IconPlaylists />, '/playlists')}
          </nav>
          <div className="sidebar-footer">
            {accountLabel ? (
              <div className="sidebar-account">
                <span className="sidebar-account-label">{accountLabel}</span>
              </div>
            ) : null}
            <button type="button" className="btn ghost sm sidebar-logout" onClick={() => logout()} title="Cerrar sesión">
              <IconLogout />
              <span className="sidebar-logout-label">Cerrar sesión</span>
            </button>
          </div>
        </aside>
        {sidebarOpen ? (
          <button
            type="button"
            className="sidebar-scrim"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <div className="app-content">
          <div className="mobile-bar">
            <button
              type="button"
              className="btn-icon"
              aria-expanded={sidebarOpen}
              aria-controls="sidebar-main"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <IconMenu />
            </button>
            <Link to="/explorer" className="brand mobile-bar-brand" onClick={() => setSidebarOpen(false)}>
              <BrandLogo size={24} />
              <span className="mobile-bar-brand-text">Cloud Media Player</span>
            </Link>
            <MobileQueueTrigger onOpen={() => setMobileQueueOpen(true)} />
          </div>
          {!isFirebaseConfigured() && (
            <div className="banner warn">
              Falta Firebase en <code>.env</code> (VITE_FIREBASE_*). Biblioteca indexada y playlists no estarán
              disponibles.
            </div>
          )}
          <div className="main-queue-row">
            <main className="main">
              <Outlet />
            </main>
            <PlayerQueuePanel
              mobileQueueOpen={mobileQueueOpen}
              onMobileQueueOpenChange={setMobileQueueOpen}
            />
          </div>
        </div>
      </div>
      {showBottomPlayerBar ? <PlayerBar /> : null}
    </div>
  )
}

export function AppShell() {
  return (
    <PlayerProvider>
      <AppShellChrome />
    </PlayerProvider>
  )
}
