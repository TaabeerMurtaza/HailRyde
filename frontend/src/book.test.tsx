import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

const rider = {
  id: 1,
  name: 'Ayesha Khan',
  email: 'rider@hailryde.test',
  phone: '03000000001',
  role: 'rider' as const,
  driver_profile: null,
}

type MapClick = { lngLat: { lat: number; lng: number }; originalEvent?: { target: EventTarget } }

const mapClicks = vi.hoisted(() => [] as Array<(event: MapClick) => void>)
const centers = vi.hoisted(() => [] as number[][])
const markers = vi.hoisted(
  () =>
    [] as Array<{
      options: { color?: string; element?: HTMLElement }
      element: HTMLElement
      lngLat: number[] | null
      added: boolean
      removed: boolean
    }>,
)

vi.mock('maplibre-gl', () => {
  class Map {
    on(event: string, handler: (event: MapClick) => void) {
      if (event === 'click') {
        mapClicks.push(handler)
      }
      return this
    }
    off() {
      return this
    }
    addSource() {
      return this
    }
    addLayer() {
      return this
    }
    getSource() {
      return { setData: () => {} }
    }
    remove() {}
    easeTo(options: { center: number[] }) {
      centers.push(options.center)
    }
    fitBounds() {}
  }

  class Marker {
    record: (typeof markers)[number]
    constructor(options: { color?: string; element?: HTMLElement } = {}) {
      this.record = {
        options,
        element: options.element ?? document.createElement('div'),
        lngLat: null,
        added: false,
        removed: false,
      }
      markers.push(this.record)
    }
    getElement() {
      return this.record.element
    }
    setLngLat(lngLat: number[]) {
      this.record.lngLat = lngLat
      return this
    }
    setDraggable() {
      return this
    }
    addTo() {
      this.record.added = true
      return this
    }
    on() {
      return this
    }
    remove() {
      this.record.removed = true
      return this
    }
  }

  return { Map, Marker, setWorkerUrl: () => {} }
})

const position = {
  coords: { latitude: 33.561778, longitude: 73.148275 },
}

function grantLocation() {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (pos: typeof position) => void) => success(position),
    },
  })
}

const pickup = { id: 'p', name: '33.561778, 73.148275', lat: '33.561778', lng: '73.148275' }
const destination = { id: 'd', name: '33.590000, 73.140000', lat: '33.590000', lng: '73.140000' }

const quote = {
  distance_km: '4.20',
  duration_min: 10,
  fare_amount: '389.00',
  currency: 'PKR',
  pickup_eta_min: 4,
  route: { type: 'LineString', coordinates: [[73.148275, 33.561778], [73.14, 33.59]] },
}

const economyDriver = { id: 2, lat: '33.555000', lng: '73.140000', category: 'economy' }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathOf(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(raw).pathname
}

function emptyOngoingRides(path: string, init?: RequestInit): Promise<Response> | null {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' && path === '/api/rides') {
    return Promise.resolve(jsonResponse({ rides: [] }))
  }
  return null
}

function renderBook() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

// Let React flush passive effects, so the map click handler sees the rendered pickup.
async function clickMap(event: MapClick) {
  await act(async () => {})
  mapClicks.at(-1)?.(event)
}

async function chooseTrip() {
  await screen.findByText('Pickup 33.561778, 73.148275')
  await clickMap({ lngLat: { lat: 33.59, lng: 73.14 } })
  expect(await screen.findByText(/389\.00/)).toBeVisible()
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

beforeEach(() => {
  mapClicks.length = 0
  markers.length = 0
  centers.length = 0
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('hailryde.token', 'rider-token')
})

it('shows a busy label while create is in flight', async () => {
  grantLocation()
  const user = userEvent.setup()
  let resolveCreate: (response: Response) => void = () => {}

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') {
        return Promise.resolve(jsonResponse({ user: rider }))
      }
      if (path === '/api/drivers') {
        return Promise.resolve(jsonResponse({ drivers: [economyDriver] }))
      }
      if (path === '/api/estimates') {
        return Promise.resolve(jsonResponse(quote))
      }
      if (path === '/api/rides' && init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveCreate = resolve
        })
      }
      if (path === '/api/rides/9') {
        return Promise.resolve(
          jsonResponse({
            ride: {
              id: 9,
              status: 'requested',
              category: 'economy',
              pickup,
              destination,
              route: quote.route,
              distance_km: '4.20',
              duration_min: 10,
              pickup_eta_min: 4,
              fare_amount: '389.00',
              currency: 'PKR',
              rider: { id: 1, name: 'Ayesha Khan', phone: '03000000001' },
              driver: null,
              accepted_at: null,
              cancelled_at: null,
              completed_at: null,
            },
          }),
        )
      }
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  await chooseTrip()
  await user.click(screen.getByRole('button', { name: 'Request ride' }))

  const busy = await screen.findByRole('button', { name: 'Requesting ride…' })
  expect(busy).toBeVisible()
  expect(busy).toBeDisabled()

  resolveCreate(jsonResponse({ ride: { id: 9 } }, 201))
})

it('shows the error and drops the busy label when create fails', async () => {
  grantLocation()
  const user = userEvent.setup()

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') {
        return Promise.resolve(jsonResponse({ user: rider }))
      }
      if (path === '/api/drivers') {
        return Promise.resolve(jsonResponse({ drivers: [economyDriver] }))
      }
      if (path === '/api/estimates') {
        return Promise.resolve(jsonResponse(quote))
      }
      if (path === '/api/rides' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              error: {
                code: 'active_ride_exists',
                message: 'You already have an active ride.',
                details: {},
              },
            },
            409,
          ),
        )
      }
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  await chooseTrip()
  await user.click(screen.getByRole('button', { name: 'Request ride' }))

  expect(await screen.findByText('You already have an active ride.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Requesting ride…' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
})

it('uses a granted position inside Soan Gardens as the pickup', async () => {
  grantLocation()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()

  expect(await screen.findByText('Pickup 33.561778, 73.148275')).toBeVisible()
})

it('ignores a map click whose target is inside a pin', async () => {
  grantLocation()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  await screen.findByText('Pickup 33.561778, 73.148275')

  const pickupMarker = markers.find((marker) => marker.options.color === '#d97706' && !marker.removed)
  expect(pickupMarker).toBeDefined()
  expect(pickupMarker?.lngLat).toEqual([73.148275, 33.561778])
  const inner = document.createElement('span')
  pickupMarker?.element.appendChild(inner)

  await clickMap({ lngLat: { lat: 33.59, lng: 73.14 }, originalEvent: { target: inner } })
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByText('Destination not set')).toBeVisible()

  await clickMap({ lngLat: { lat: 33.59, lng: 73.14 }, originalEvent: { target: document.body } })
  expect(await screen.findByText('Destination 33.590000, 73.140000')).toBeVisible()
})

it('keeps quoting when a driver poll fails after a successful one', async () => {
  grantLocation()
  const intervals: Array<() => void> = []
  const realSetInterval = window.setInterval.bind(window)
  vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay === 10000 && typeof handler === 'function') {
      intervals.push(handler as () => void)
      return 0
    }
    return realSetInterval(handler, delay, ...args)
  }) as typeof window.setInterval)

  let driverCalls = 0
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathOf(input)
    const ongoing = emptyOngoingRides(path, init)
    if (ongoing) {
      return ongoing
    }
    if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
    if (path === '/api/drivers') {
      driverCalls += 1
      return driverCalls === 1
        ? Promise.resolve(jsonResponse({ drivers: [economyDriver] }))
        : Promise.reject(new Error('network down'))
    }
    if (path === '/api/estimates') return Promise.resolve(jsonResponse(quote))
    return Promise.reject(new Error(`unmocked ${path}`))
  })
  vi.stubGlobal('fetch', fetchMock)

  renderBook()
  await waitFor(() => expect(driverCalls).toBe(1))
  await waitFor(() => expect(intervals).toHaveLength(1))

  await act(async () => {
    intervals[0]()
  })
  expect(driverCalls).toBe(2)

  await chooseTrip()
  expect(screen.queryByText(/Could not reach HailRyde/)).not.toBeInTheDocument()

  const driverMarkers = markers.filter(
    (marker) => marker.lngLat?.[0] === 73.14 && marker.lngLat?.[1] === 33.555,
  )
  expect(driverMarkers).toHaveLength(1)
  expect(driverMarkers[0].added).toBe(true)
  expect(driverMarkers[0].removed).toBe(false)

})

it('ignores a quote response for an older pin pair', async () => {
  grantLocation()
  const pending: Array<(response: Response) => void> = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      if (path === '/api/estimates') {
        return new Promise<Response>((resolve) => {
          pending.push(resolve)
        })
      }
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  await screen.findByText('Pickup 33.561778, 73.148275')

  await clickMap({ lngLat: { lat: 33.59, lng: 73.14 } })
  await waitFor(() => expect(pending).toHaveLength(1))

  await clickMap({ lngLat: { lat: 33.575, lng: 73.155 } })
  await waitFor(() => expect(pending).toHaveLength(2))

  await act(async () => {
    pending[0](jsonResponse({ ...quote, fare_amount: '1.00' }))
  })
  expect(screen.queryByText(/^1\.00 PKR/)).not.toBeInTheDocument()

  await act(async () => {
    pending[1](jsonResponse({ ...quote, fare_amount: '389.00' }))
  })
  expect(await screen.findByText(/389\.00/)).toBeVisible()
  expect(screen.queryByText(/^1\.00 PKR/)).not.toBeInTheDocument()
})

it('does not move a placed pickup when a GPS fix arrives late', async () => {
  let deliver: ((pos: typeof position) => void) | null = null
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (pos: typeof position) => void) => {
        deliver = success
      },
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  await screen.findByText('Pickup not set')
  await waitFor(() => expect(deliver).not.toBeNull())

  await clickMap({ lngLat: { lat: 33.57, lng: 73.16 } })
  expect(await screen.findByText('Pickup 33.570000, 73.160000')).toBeVisible()

  await act(async () => {
    deliver?.(position)
  })

  expect(screen.getByText('Pickup 33.570000, 73.160000')).toBeVisible()
  expect(screen.queryByText('Pickup 33.561778, 73.148275')).not.toBeInTheDocument()
})

it('asks for a network location before a precise one', async () => {
  const accuracy: boolean[] = []
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (
        success: (pos: typeof position) => void,
        _error: unknown,
        options?: PositionOptions,
      ) => {
        accuracy.push(Boolean(options?.enableHighAccuracy))
        success(position)
      },
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  expect(await screen.findByText('Pickup 33.561778, 73.148275')).toBeVisible()
  expect(accuracy).toEqual([false])
  expect(centers).toEqual([[73.148275, 33.561778]])
})

it('uses a precise fix when the network location times out', async () => {
  const accuracy: boolean[] = []
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (
        success: (pos: typeof position) => void,
        error: (err: { code: number }) => void,
        options?: PositionOptions,
      ) => {
        const precise = Boolean(options?.enableHighAccuracy)
        accuracy.push(precise)
        if (precise) {
          success(position)
        } else {
          error({ code: 3 })
        }
      },
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  expect(await screen.findByText('Pickup 33.561778, 73.148275')).toBeVisible()
  expect(accuracy).toEqual([false, true])
})

it('shows that location is in progress and then sets the pickup from the button', async () => {
  const user = userEvent.setup()
  let allow = false
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (
        success: (pos: typeof position) => void,
        error: (err: { code: number }) => void,
      ) => {
        if (allow) {
          success(position)
        } else {
          error({ code: 2 })
        }
      },
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      const ongoing = emptyOngoingRides(path, init)
      if (ongoing) {
        return ongoing
      }
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  expect(await screen.findByText('Place the pickup pin on the map.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled()

  allow = true
  let release: (pos: typeof position) => void = () => {}
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (pos: typeof position) => void) => {
        release = success
      },
    },
  })

  await user.click(screen.getByRole('button', { name: 'Use my location' }))
  expect(screen.getByRole('button', { name: 'Finding your location…' })).toBeDisabled()

  await act(async () => {
    release(position)
  })

  expect(await screen.findByText('Pickup 33.561778, 73.148275')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled()
  expect(screen.queryByText('Place the pickup pin on the map.')).not.toBeInTheDocument()
})
