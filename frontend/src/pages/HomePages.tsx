import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../use-auth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth()

  if (!ready) {
    return <p className="text-sm">Loading session…</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export function RequireRole({ role, children }: { role: 'rider' | 'driver'; children: ReactNode }) {
  const { user } = useAuth()

  if (!user || user.role === role) {
    return children
  }

  const home = user.role === 'driver' ? '/drive' : '/'
  const label = user.role === 'driver' ? 'Back to the driver desk' : 'Back to booking'

  return (
    <section className="mx-auto max-w-md rounded-xl border border-stone-200 bg-white p-6">
      <h1 className="mb-2 text-2xl font-semibold">Not available</h1>
      <p>You can't open this screen with your account.</p>
      <p className="mt-4">
        <Link to={home} className="underline">
          {label}
        </Link>
      </p>
    </section>
  )
}

