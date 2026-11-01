import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { api } from '../api'
import { useAuth } from '../use-auth'
import type { ApiError, Ride } from '../types'

const buttonClass =
  'rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60'

export function ResumeActiveRide({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [rideId, setRideId] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)

    const queries =
      user?.role === 'driver'
        ? ['/api/rides?status=accepted']
        : ['/api/rides?status=accepted', '/api/rides?status=requested']

    Promise.all(queries.map((path) => api<{ rides?: Ride[] }>(path)))
      .then((bodies) => {
        if (cancelled) {
          return
        }

        const ride = bodies.flatMap((body) => (body && Array.isArray(body.rides) ? body.rides : []))[0]
        setRideId(ride?.id ?? null)
        setReady(true)
      })
      .catch((caught: ApiError) => {
        if (cancelled) {
          return
        }

        setRideId(null)
        setError(caught)
        setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [attempt, user?.role])

  if (!ready) {
    return <p className="text-sm">Loading ride…</p>
  }

  if (error) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-red-800">{error.message}</p>
        <button type="button" onClick={() => setAttempt((count) => count + 1)} className={buttonClass}>
          Retry
        </button>
      </section>
    )
  }

  if (rideId !== null) {
    return <Navigate to={`/rides/${rideId}`} replace />
  }

  return children
}
