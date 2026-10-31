import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { api } from '../api'
import { RideMap } from '../components/RideMap'
import { useAuth } from '../use-auth'
import { useUserLocation } from '../use-user-location'
import type { LineString } from 'geojson'
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

  const pickupLat = ride?.pickup.lat
  const pickupLng = ride?.pickup.lng
  const destinationLat = ride?.destination.lat
  const destinationLng = ride?.destination.lng
  const routeKey = ride?.route ? JSON.stringify(ride.route) : null
  const driverId = ride?.driver?.id
  const driverLat = ride?.driver?.lat
  const driverLng = ride?.driver?.lng
  const driverCategory = ride?.driver?.category

  // Polling replaces the ride object every 3 seconds. Memoize map inputs on their values
  // so RideMap effects do not remove and re-add pins when nothing moved.
  const pickup = useMemo(
    () => ({ lat: Number(pickupLat), lng: Number(pickupLng) }),
    [pickupLat, pickupLng],
  )
  const destination = useMemo(
    () => ({ lat: Number(destinationLat), lng: Number(destinationLng) }),
    [destinationLat, destinationLng],
  )
  const route = useMemo<LineString | null>(
    () => (routeKey ? (JSON.parse(routeKey) as LineString) : null),
    [routeKey],
  )
  const drivers = useMemo<DriverDot[]>(
    () =>
      driverId !== undefined && driverLat !== undefined && driverLng !== undefined && driverCategory
        ? [{ id: driverId, lat: driverLat, lng: driverLng, category: driverCategory }]
        : [],
    [driverId, driverLat, driverLng, driverCategory],
  )

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
            pickup={pickup}
            destination={destination}
            route={route}
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
