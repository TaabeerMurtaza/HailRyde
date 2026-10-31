import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { api } from '../api'
import { useAuth } from '../use-auth'
import type { ApiError, Place, Ride } from '../types'

const buttonClass =
  'rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60'

export function RideStatusPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [ride, setRide] = useState<Ride | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<ApiError | null>(null)
  const pollGeneration = useRef(0)

  useEffect(() => {
    if (!id) {
      return
    }

    let cancelled = false

    api<{ ride: Ride }>(`/api/rides/${id}`)
      .then((body) => {
        if (!cancelled) {
          setRide(body.ride)
          setLoadError(null)
        }
      })
      .catch((caught: ApiError) => {
        if (!cancelled) {
          setLoadError(caught)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const status = ride?.status

  useEffect(() => {
    if (!id || (status !== 'requested' && status !== 'accepted')) {
      return
    }

    const generation = pollGeneration.current
    const timer = window.setInterval(() => {
      api<{ ride: Ride }>(`/api/rides/${id}`)
        .then((body) => {
          if (pollGeneration.current !== generation) {
            return
          }
          setRide(body.ride)
          setLoadError(null)
        })
        .catch((caught: ApiError) => {
          if (pollGeneration.current === generation) {
            setLoadError(caught)
          }
        })
    }, 3000)

    return () => {
      pollGeneration.current += 1
      window.clearInterval(timer)
    }
  }, [id, status])

  async function cancelRide() {
    if (!id || cancelling) {
      return
    }

    setCancelling(true)
    setCancelError(null)
    pollGeneration.current += 1

    try {
      const body = await api<{ ride: Ride }>(`/api/rides/${id}/cancel`, { method: 'POST' })
      setRide(body.ride)
    } catch (caught) {
      setCancelError(caught as ApiError)
    } finally {
      setCancelling(false)
    }
  }

  const canCancel =
    user?.role === 'rider' && (ride?.status === 'requested' || ride?.status === 'accepted')

  return (
    <section className="mx-auto w-full max-w-md">
      <h1 className="text-3xl font-semibold tracking-tight">Ride status</h1>
      {loadError ? <p className="mt-4 text-sm text-red-800">{loadError.message}</p> : null}
      {ride ? (
        <div className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <p>Your {ride.category} ride is confirmed.</p>
          <p>
            Status <span className="font-medium">{ride.status}</span>
          </p>
          <PlaceMap pickup={ride.pickup} destination={ride.destination} />
          <p>Pickup {ride.pickup.name}</p>
          <p>Destination {ride.destination.name}</p>
          <p>
            Fare {ride.fare_amount} {ride.currency}
          </p>
          <p>{ride.distance_km} km</p>
          <p>{ride.duration_min} min</p>
          <p>
            {ride.pickup_eta_min === null
              ? 'No driver is available nearby.'
              : `Pickup in ${ride.pickup_eta_min} min`}
          </p>
          {ride.driver ? (
            <p>
              Driver {ride.driver.name}, {ride.driver.phone}, plate {ride.driver.plate}
            </p>
          ) : null}
          {canCancel ? (
            <div className="space-y-2">
              {cancelError ? <p className="text-sm text-red-800">{cancelError.message}</p> : null}
              <button
                type="button"
                disabled={cancelling}
                aria-busy={cancelling}
                onClick={() => void cancelRide()}
                className={buttonClass}
              >
                {cancelling ? 'Cancelling…' : 'Cancel ride'}
              </button>
            </div>
          ) : null}
        </div>
      ) : loadError ? null : (
        <p className="mt-4 text-sm">Loading ride…</p>
      )}
    </section>
  )
}

function PlaceMap({ pickup, destination }: { pickup: Place; destination: Place }) {
  const lats = [Number(pickup.lat), Number(destination.lat)]
  const lngs = [Number(pickup.lng), Number(destination.lng)]
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latSpan = Math.max(maxLat - minLat, 0.000001)
  const lngSpan = Math.max(maxLng - minLng, 0.000001)

  function point(place: Place) {
    return {
      x: 40 + ((Number(place.lng) - minLng) / lngSpan) * 240,
      y: 36 + ((maxLat - Number(place.lat)) / latSpan) * 88,
    }
  }

  const from = point(pickup)
  const to = point(destination)

  return (
    <svg
      viewBox="0 0 320 160"
      role="img"
      aria-label={`${pickup.name} to ${destination.name}`}
      className="h-40 w-full rounded-md bg-stone-100"
    >
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#1c1917" strokeWidth="2" />
      <circle cx={from.x} cy={from.y} r="6" fill="#d97706" />
      <circle cx={to.x} cy={to.y} r="6" fill="#1c1917" />
      <text x={from.x + 10} y={from.y - 8} fill="#1c1917" fontSize="12">
        {pickup.name}
      </text>
      <text x={to.x + 10} y={to.y + 16} fill="#1c1917" fontSize="12">
        {destination.name}
      </text>
    </svg>
  )
}
