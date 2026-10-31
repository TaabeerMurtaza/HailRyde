import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../use-auth'
import type { ApiError, Ride } from '../types'

const buttonClass =
  'rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60'

export function DriverDeskPage() {
  const { user } = useAuth()
  const category = user?.driver_profile?.category
  const [requested, setRequested] = useState<Ride[] | null>(null)
  const [accepted, setAccepted] = useState<Ride[] | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [actionError, setActionError] = useState<ApiError | null>(null)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [completingId, setCompletingId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api<{ rides?: Ride[] }>('/api/rides?status=requested'),
      api<{ rides?: Ride[] }>('/api/rides?status=accepted'),
    ])
      .then(([requestedBody, acceptedBody]) => {
        if (!cancelled) {
          setRequested(Array.isArray(requestedBody.rides) ? requestedBody.rides : [])
          setAccepted(Array.isArray(acceptedBody.rides) ? acceptedBody.rides : [])
          setLoadError(null)
        }
      })
      .catch((caught: ApiError) => {
        if (!cancelled) {
          setLoadError(caught)
          setRequested([])
          setAccepted([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function acceptRide(id: number) {
    if (acceptingId !== null) {
      return
    }

    setAcceptingId(id)
    setActionError(null)

    try {
      const body = await api<{ ride: Ride }>(`/api/rides/${id}/accept`, { method: 'POST' })
      setRequested((current) => (current ?? []).filter((ride) => ride.id !== id))
      setAccepted((current) => [body.ride, ...(current ?? []).filter((ride) => ride.id !== id)])
    } catch (caught) {
      setActionError(caught as ApiError)
    } finally {
      setAcceptingId(null)
    }
  }

  async function completeRide(id: number) {
    if (completingId !== null) {
      return
    }

    setCompletingId(id)
    setActionError(null)

    try {
      await api<{ ride: Ride }>(`/api/rides/${id}/complete`, { method: 'POST' })
      setAccepted((current) => (current ?? []).filter((ride) => ride.id !== id))
    } catch (caught) {
      setActionError(caught as ApiError)
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">Driver desk</h1>
      <p className="mt-2 text-stone-700">
        Signed in as {user?.name}
        {category ? `, ${category}` : ''}.
      </p>
      {loadError ? <p className="mt-4 text-sm text-red-800">{loadError.message}</p> : null}
      {actionError ? <p className="mt-4 text-sm text-red-800">{actionError.message}</p> : null}

      <h2 className="mt-8 text-xl font-semibold">Requested rides</h2>
      {requested === null ? <p className="mt-2 text-sm">Loading rides…</p> : null}
      {requested?.length === 0 ? <p className="mt-2 text-sm">No requested rides.</p> : null}
      <ul className="mt-3 space-y-3">
        {requested?.map((ride) => (
          <li key={ride.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <RideSummary ride={ride} />
            <button
              type="button"
              disabled={acceptingId === ride.id}
              aria-busy={acceptingId === ride.id}
              onClick={() => void acceptRide(ride.id)}
              className={`mt-3 ${buttonClass}`}
            >
              {acceptingId === ride.id ? 'Accepting…' : 'Accept'}
            </button>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Accepted ride</h2>
      {accepted?.length === 0 ? <p className="mt-2 text-sm">No accepted ride.</p> : null}
      <ul className="mt-3 space-y-3">
        {accepted?.map((ride) => (
          <li key={ride.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <RideSummary ride={ride} />
            <button
              type="button"
              disabled={completingId === ride.id}
              aria-busy={completingId === ride.id}
              onClick={() => void completeRide(ride.id)}
              className={`mt-3 ${buttonClass}`}
            >
              {completingId === ride.id ? 'Completing…' : 'Complete'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RideSummary({ ride }: { ride: Ride }) {
  return (
    <div className="text-sm">
      <p className="font-medium">
        {ride.pickup.name} to {ride.destination.name}
      </p>
      <p>
        {ride.fare_amount} {ride.currency} · {ride.category}
      </p>
      <p>
        Rider {ride.rider.name}, {ride.rider.phone}
      </p>
    </div>
  )
}
