import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { RideMap } from '../components/RideMap'
import { format6 } from '../lahore'
import { useAuth } from '../use-auth'
import { useUserLocation } from '../use-user-location'
import type { ApiError, DriverDot, Estimate, RideCategory } from '../types'

const IDEMPOTENCY_STORAGE_KEY = 'hailryde.idempotency-key'
const DRIVER_POLL_MS = 10000
const QUOTE_DELAY_MS = 400

const buttonClass =
  'rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60'

type Pin = { lat: number; lng: number }

function pinKey(pin: Pin | null): string {
  return pin ? `${format6(pin.lat)},${format6(pin.lng)}` : ''
}

function pinLabel(pin: Pin | null): string {
  return pin ? `${format6(pin.lat)}, ${format6(pin.lng)}` : 'not set'
}

function tripBody(pickupKey: string, destinationKey: string, category: RideCategory) {
  const [pickupLat, pickupLng] = pickupKey.split(',').map(Number)
  const [destinationLat, destinationLng] = destinationKey.split(',').map(Number)
  return {
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    destination_lat: destinationLat,
    destination_lng: destinationLng,
    category,
  }
}

function ensureIdempotencyKey(): string {
  const existing = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const key = crypto.randomUUID()
  sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, key)
  return key
}

export function BookPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { user: here, note, refresh } = useUserLocation()
  const [pickup, setPickup] = useState<Pin | null>(null)
  const [destination, setDestination] = useState<Pin | null>(null)
  const [category, setCategory] = useState<RideCategory>('economy')
  const [drivers, setDrivers] = useState<DriverDot[]>([])
  const [quote, setQuote] = useState<Estimate | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<ApiError | null>(null)
  const [quoteAttempt, setQuoteAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)

  const pickupKey = pinKey(pickup)
  const destinationKey = pinKey(destination)
  const differentPins = pickupKey !== '' && destinationKey !== '' && pickupKey !== destinationKey
  const tripKey = `${pickupKey}|${destinationKey}|${category}`
  const seenTrip = useRef<string | null>(null)

  useEffect(() => {
    if (here) {
      setPickup((current) => current ?? here)
    }
  }, [here])

  useEffect(() => {
    let cancelled = false

    function load() {
      api<{ drivers?: DriverDot[] }>(`/api/drivers?category=${category}`)
        .then((body) => {
          if (!cancelled && Array.isArray(body.drivers)) {
            setDrivers(body.drivers)
          }
        })
        .catch(() => {})
    }

    load()
    const timer = window.setInterval(load, DRIVER_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [category])

  useEffect(() => {
    if (seenTrip.current === null) {
      seenTrip.current = tripKey
      return
    }

    if (seenTrip.current === tripKey) {
      return
    }

    seenTrip.current = tripKey
    sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY)
    setSubmitError(null)
  }, [tripKey])

  useEffect(() => {
    setQuote(null)
    setQuoteError(null)

    if (!differentPins) {
      setQuoteLoading(false)
      return
    }

    let cancelled = false
    setQuoteLoading(true)

    const timer = window.setTimeout(() => {
      api<Estimate>('/api/estimates', {
        method: 'POST',
        body: JSON.stringify(tripBody(pickupKey, destinationKey, category)),
      })
        .then((next) => {
          if (!cancelled) {
            setQuote(next)
            setQuoteLoading(false)
          }
        })
        .catch((caught: ApiError) => {
          if (!cancelled) {
            setQuoteError(caught)
            setQuoteLoading(false)
          }
        })
    }, QUOTE_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [category, destinationKey, differentPins, pickupKey, quoteAttempt])

  async function handleUseMyLocation() {
    const fix = await refresh()
    if (fix) {
      setPickup(fix)
    }
  }

  async function requestRide() {
    if (!differentPins || submitting) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    const key = ensureIdempotencyKey()

    try {
      const body = await api<{ ride: { id: number } }>('/api/rides', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(tripBody(pickupKey, destinationKey, category)),
      })
      sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY)
      navigate(`/rides/${body.ride.id}`)
    } catch (caught) {
      setSubmitError(caught as ApiError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Book a ride</h1>
      <p className="mt-2 text-stone-700">Signed in as {user?.name}.</p>

      <form
        className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          void requestRide()
        }}
      >
        <RideMap
          pickup={pickup}
          destination={destination}
          user={here}
          drivers={drivers}
          route={quote?.route ?? null}
          interactive={!submitting}
          onPickup={(lat, lng) => setPickup({ lat, lng })}
          onDestination={(lat, lng) => setDestination({ lat, lng })}
        />

        <div className="space-y-1 text-sm">
          <p>Pickup {pinLabel(pickup)}</p>
          <p>Destination {pinLabel(destination)}</p>
          {!pickup && note ? <p>{note}</p> : null}
          <button type="button" onClick={() => void handleUseMyLocation()} disabled={submitting} className={buttonClass}>
            Use my location
          </button>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Category</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="category"
                value="economy"
                checked={category === 'economy'}
                onChange={() => setCategory('economy')}
              />
              Economy
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="category"
                value="comfort"
                checked={category === 'comfort'}
                onChange={() => setCategory('comfort')}
              />
              Comfort
            </label>
          </div>
        </fieldset>

        <div aria-live="polite" className="rounded-md border border-stone-200 bg-stone-50 p-4 text-sm">
          <h2 className="mb-2 font-medium">Quote</h2>
          {quoteLoading ? <p>Loading quote…</p> : null}
          {!quoteLoading && !quote && !quoteError ? <p>Set a pickup and a destination.</p> : null}
          {quote && !quoteLoading ? (
            <dl className="space-y-1">
              <div>
                <dt className="inline">Fare </dt>
                <dd className="inline">
                  {quote.fare_amount} {quote.currency}
                </dd>
              </div>
              <div>
                <dt className="inline">Distance </dt>
                <dd className="inline">{quote.distance_km} km</dd>
              </div>
              <div>
                <dt className="inline">Duration </dt>
                <dd className="inline">{quote.duration_min} min</dd>
              </div>
              <div>
                <dt className="sr-only">Pickup ETA</dt>
                <dd>
                  {quote.pickup_eta_min === null
                    ? 'No driver is available nearby.'
                    : `Pickup in ${quote.pickup_eta_min} min`}
                </dd>
              </div>
            </dl>
          ) : null}
          {quoteError ? (
            <div className="mt-2">
              <p className="text-red-800">{quoteError.message}</p>
              <button type="button" onClick={() => setQuoteAttempt((count) => count + 1)} className={`mt-2 ${buttonClass}`}>
                Retry
              </button>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-stone-600">Routes by OSRM</p>
        </div>

        {submitError ? <p className="text-sm text-red-800">{submitError.message}</p> : null}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting || !quote || quoteLoading} aria-busy={submitting} className={buttonClass}>
            {submitting ? 'Requesting ride…' : 'Request ride'}
          </button>
          {submitError ? (
            <button type="button" disabled={submitting} onClick={() => void requestRide()} className={buttonClass}>
              Retry
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
