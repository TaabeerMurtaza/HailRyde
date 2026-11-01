import { Link, Route, Routes } from 'react-router'
import { AuthProvider } from './auth'
import { useAuth } from './use-auth'
import { BookPage } from './pages/BookPage'
import { DriverDeskPage } from './pages/DriverDeskPage'
import { RequireAuth, RequireRole } from './pages/HomePages'
import { ResumeActiveRide } from './pages/ResumeActiveRide'
import { RideStatusPage } from './pages/RideStatusPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <RequireRole role="rider">
                    <ResumeActiveRide>
                      <BookPage />
                    </ResumeActiveRide>
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/drive"
              element={
                <RequireAuth>
                  <RequireRole role="driver">
                    <ResumeActiveRide>
                      <DriverDeskPage />
                    </ResumeActiveRide>
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/rides/:id"
              element={
                <RequireAuth>
                  <RideStatusPage />
                </RequireAuth>
              }
            />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}

function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="border-b border-stone-300 bg-stone-950 text-amber-300">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
        <Link to={user?.role === 'driver' ? '/drive' : '/'} className="text-xl font-semibold tracking-tight">
          HailRyde
        </Link>
        {user ? (
          <button type="button" onClick={() => void logout()} className="text-sm underline">
            Log out
          </button>
        ) : null}
      </div>
    </header>
  )
}
