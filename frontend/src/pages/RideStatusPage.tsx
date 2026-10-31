import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { api } from '../api'
import { RideMap } from '../components/RideMap'
import { useAuth } from '../use-auth'
import { useUserLocation } from '../use-user-location'
import type { ApiError, DriverDot, Ride } from '../types'

function noop() {}

const buttonClass =
  'rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60'

export function RideStatusPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { user: userLocation } = useUserLocation()
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

  const drivers: DriverDot[] = ride?.driver
    ? [
        {
          id: ride.driver.id,
          lat: ride.driver.lat,
          lng: ride.driver.lng,
          category: ride.driver.category,
        },
      ]
    : []

  return (
    <section className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Ride status</h1>
      {loadError ? <p className="mt-4 text-sm text-red-800">{loadError.message}</p> : null}
      {ride ? (
        <div className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <p>Your {ride.category} ride is confirmed.</p>
          <p>
            Status <span className="font-medium">{ride.status}</span>
          </p>
          <RideMap
            pickup={{ lat: Number(ride.pickup.lat), lng: Number(ride.pickup.lng) }}
            destination={{ lat: Number(ride.destination.lat), lng: Number(ride.destination.lng) }}
            route={ride.route}
            drivers={drivers}
            user={userLocation}
            interactive={false}
            onPickup={noop}
            onDestination={noop}
          />
          <p>Pickup {ride.pickup.name}</p>
          <p>Destination {ride.destination.name}</p>
          <p>
            Fare <span data-testid="ride-fare">{ride.fare_amount}</span> {ride.currency}
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
