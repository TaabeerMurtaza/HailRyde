import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api'
import { Field } from '../components/Field'
import { useAuth } from '../use-auth'
import type { ApiError, Estimate, Place, RideCategory } from '../types'

const IDEMPOTENCY_STORAGE_KEY = 'hailryde.idempotency-key'

const selectClass =
  'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-900'

const buttonClass =
  'rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60'

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
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [placesError, setPlacesError] = useState<ApiError | null>(null)
  const [pickupId, setPickupId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [category, setCategory] = useState<RideCategory>('economy')
  const [quote, setQuote] = useState<Estimate | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)

  const differentPlaces = pickupId !== '' && destinationId !== '' && pickupId !== destinationId
  const tripKey = `${pickupId}|${destinationId}|${category}`
  const seenTrip = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api<{ places?: Place[] }>('/api/places')
      .then((body) => {
        if (!cancelled) {
          setPlaces(Array.isArray(body.places) ? body.places : [])
        }
      })
      .catch((caught: ApiError) => {
        if (!cancelled) {
          setPlacesError(caught)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

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
    if (!differentPlaces) {
      setQuote(null)
      setQuoteLoading(false)
      setQuoteError(null)
      return
    }

    let cancelled = false
    setQuoteLoading(true)
    setQuoteError(null)

    api<Estimate>('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({
        pickup_place_id: pickupId,
        destination_place_id: destinationId,
        category,
      }),
    })
      .then((next) => {
        if (!cancelled) {
          setQuote(next)
          setQuoteLoading(false)
        }
      })
      .catch((caught: ApiError) => {
        if (!cancelled) {
          setQuote(null)
          setQuoteError(caught)
          setQuoteLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [category, destinationId, differentPlaces, pickupId])

  async function requestRide() {
    if (!differentPlaces || submitting) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    const key = ensureIdempotencyKey()

    try {
      const body = await api<{ ride: { id: number } }>('/api/rides', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          pickup_place_id: pickupId,
          destination_place_id: destinationId,
          category,
        }),
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
    <section className="mx-auto w-full max-w-md">
      <h1 className="text-3xl font-semibold tracking-tight">Book a ride</h1>
      <p className="mt-2 text-stone-700">Signed in as {user?.name}.</p>

      <form
        className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          void requestRide()
        }}
      >
        {placesError ? <p className="text-sm text-red-800">{placesError.message}</p> : null}
        {places ? (
          <>
            <PlaceSelect label="Pickup" places={places} value={pickupId} onChange={setPickupId} />
            <PlaceSelect label="Destination" places={places} value={destinationId} onChange={setDestinationId} />
          </>
        ) : placesError ? null : (
          <p className="text-sm">Loading places…</p>
        )}

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
          {!quoteLoading && !quote && !quoteError ? <p>Choose two different places.</p> : null}
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
          {quoteError ? <p className="mt-2 text-red-800">{quoteError.message}</p> : null}
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

function PlaceSelect({
  label,
  places,
  value,
  onChange,
}: {
  label: string
  places: Place[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} messages={[]}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">Select a place</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </select>
    </Field>
  )
}
