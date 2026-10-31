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
const pinElements = vi.hoisted(() => [] as HTMLElement[])

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
  }

  class Marker {
    element: HTMLElement
    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element ?? document.createElement('div')
      pinElements.push(this.element)
    }
    getElement() {
      return this.element
    }
    setLngLat() {
      return this
    }
    setDraggable() {
      return this
    }
    addTo() {
      return this
    }
    on() {
      return this
    }
    remove() {
      return this
    }
  }

  return { Map, Marker, setWorkerUrl: () => {} }
})

const position = {
  coords: { latitude: 31.5204, longitude: 74.3587 },
}

function grantLocation() {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: (pos: typeof position) => void) => success(position),
    },
  })
}

const pickup = { id: 'p', name: '31.520400, 74.358700', lat: '31.520400', lng: '74.358700' }
const destination = { id: 'd', name: '31.521600, 74.403600', lat: '31.521600', lng: '74.403600' }

const quote = {
  distance_km: '4.20',
  duration_min: 10,
  fare_amount: '389.00',
  currency: 'PKR',
  pickup_eta_min: 4,
  route: { type: 'LineString', coordinates: [[74.3587, 31.5204], [74.4036, 31.5216]] },
}

const economyDriver = { id: 2, lat: '31.510100', lng: '74.343600', category: 'economy' }

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

function renderBook() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

async function chooseTrip() {
  await screen.findByText('Pickup 31.520400, 74.358700')
  mapClicks.at(-1)?.({ lngLat: { lat: 31.5216, lng: 74.4036 } })
  expect(await screen.findByText(/389\.00/)).toBeVisible()
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

beforeEach(() => {
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

it('uses a granted position inside Lahore as the pickup', async () => {
  grantLocation()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()

  expect(await screen.findByText('Pickup 31.520400, 74.358700')).toBeVisible()
})

it('ignores a map click whose target is inside a pin', async () => {
  grantLocation()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  await screen.findByText('Pickup 31.520400, 74.358700')

  const pinElement = pinElements.find((element) => 'pin' in element.dataset)
  expect(pinElement).toBeDefined()
  const inner = document.createElement('span')
  pinElement?.appendChild(inner)

  mapClicks.at(-1)?.({ lngLat: { lat: 31.5216, lng: 74.4036 }, originalEvent: { target: inner } })
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByText('Destination not set')).toBeVisible()

  mapClicks.at(-1)?.({ lngLat: { lat: 31.5216, lng: 74.4036 }, originalEvent: { target: document.body } })
  expect(await screen.findByText('Destination 31.521600, 74.403600')).toBeVisible()
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
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const path = pathOf(input)
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

  vi.restoreAllMocks()
})

it('ignores a quote response for an older pin pair', async () => {
  grantLocation()
  const pending: Array<(response: Response) => void> = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input)
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
  await screen.findByText('Pickup 31.520400, 74.358700')

  mapClicks.at(-1)?.({ lngLat: { lat: 31.5216, lng: 74.4036 } })
  await waitFor(() => expect(pending).toHaveLength(1))

  mapClicks.at(-1)?.({ lngLat: { lat: 31.53, lng: 74.38 } })
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
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input)
      if (path === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (path === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${path}`))
    }),
  )

  renderBook()
  await screen.findByText('Pickup not set')
  await waitFor(() => expect(deliver).not.toBeNull())

  mapClicks.at(-1)?.({ lngLat: { lat: 31.55, lng: 74.4 } })
  expect(await screen.findByText('Pickup 31.550000, 74.400000')).toBeVisible()

  await act(async () => {
    deliver?.(position)
  })

  expect(screen.getByText('Pickup 31.550000, 74.400000')).toBeVisible()
  expect(screen.queryByText('Pickup 31.520400, 74.358700')).not.toBeInTheDocument()
})
