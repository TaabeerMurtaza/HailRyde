import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

const mapClicks = vi.hoisted(() => [] as Array<(event: { lngLat: { lat: number; lng: number } }) => void>)

vi.mock('maplibre-gl', () => {
  class Map {
    on(event: string, handler: (event: { lngLat: { lat: number; lng: number } }) => void) {
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
