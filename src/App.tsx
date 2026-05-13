import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { FirebaseUserProvider } from './context/FirebaseUserContext'
import { LoginPage } from './pages/LoginPage'
import { ExplorerPage } from './pages/ExplorerPage'
import { LibraryPage } from './pages/LibraryPage'
import { PlaylistsPage } from './pages/PlaylistsPage'
import { PlaylistDetailPage } from './pages/PlaylistDetailPage'
import { ProtectedMsal, AppShell } from './routes/AppShell'

function FirebaseLayout() {
  return (
    <FirebaseUserProvider>
      <Outlet />
    </FirebaseUserProvider>
  )
}

export default function App() {
  return (
    <div className="app-viewport-fill">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedMsal />}>
          <Route element={<FirebaseLayout />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/explorer" replace />} />
              <Route path="/explorer" element={<ExplorerPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/explorer" replace />} />
      </Routes>
    </div>
  )
}
