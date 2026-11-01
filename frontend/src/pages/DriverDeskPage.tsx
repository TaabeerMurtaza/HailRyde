import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { useAuth } from '../use-auth'
import type { ApiError, Ride } from '../types'

const buttonClass =
  'rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60'

const REQUEST_POLL_MS = 3000

export function DriverDeskPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const category = user?.driver_profile?.category
  const [requested, setRequested] = useState<Ride[] | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [actionError, setActionError] = useState<ApiError | null>(null)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const listGeneration = useRef(0)

  useEffect(() => {
    let cancelled = false

    function load() {
      const started = listGeneration.current

      api<{ rides?: Ride[] }>('/api/rides?status=requested')
        .then((body) => {
          if (cancelled || listGeneration.current !== started) {
            return
          }
          setRequested(Array.isArray(body.rides) ? body.rides : [])
          setLoadError(null)
        })
        .catch((caught: ApiError) => {
          if (cancelled || listGeneration.current !== started) {
            return
          }
          setLoadError(caught)
          setRequested((current) => current ?? [])
        })
    }

    load()
    const timer = window.setInterval(load, REQUEST_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
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
      navigate(`/rides/${body.ride.id}`)
    } catch (caught) {
      const error = caught as ApiError
      setActionError(error)
      if (error.code === 'invalid_transition') {
        listGeneration.current += 1
        setRequested((current) => (current ?? []).filter((ride) => ride.id !== id))
      }
    } finally {
      setAcceptingId(null)
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
