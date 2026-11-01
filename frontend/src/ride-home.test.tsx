import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import type { Ride } from './types'

vi.mock('maplibre-gl', () => {
  class Map {
    on() {
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
      return { setData() {} }
    }
    remove() {}
    easeTo() {}
    fitBounds() {}
  }

  class Marker {
    element = document.createElement('div')
    setLngLat() {
      return this
    }
    setDraggable() {
      return this
    }
    addTo() {
      return this
    }
    getElement() {
      return this.element
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

const rider = {
  id: 1,
  name: 'Ayesha Khan',
  email: 'rider@hailryde.test',
  phone: '03000000001',
  role: 'rider' as const,
  driver_profile: null,
}

const driver = {
  id: 2,
  name: 'Bilal Ahmed',
  email: 'bilal@example.com',
  phone: '03000000002',
  role: 'driver' as const,
  driver_profile: {
    plate: 'LEA-1001',
    category: 'economy' as const,
    status: 'on_trip' as const,
    lat: '33.561778',
    lng: '73.148275',
  },
}

const pickup = { id: 'p', name: '33.561778, 73.148275', lat: '33.561778', lng: '73.148275' }
const destination = { id: 'd', name: '33.590000, 73.140000', lat: '33.590000', lng: '73.140000' }

function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 9,
    status: 'requested',
    category: 'economy',
    pickup,
    destination,
    route: null,
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
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL): URL {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(raw)
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('hailryde.token', 'token')
})

it('sends a rider home to the accepted ride when one is ongoing', async () => {
  const accepted = ride({ status: 'accepted', driver: { id: 2, name: 'Bilal Ahmed', phone: '03000000002', plate: 'LEA-1001', category: 'economy', lat: '33.561778', lng: '73.148275' } })
  const requested = ride({ id: 4, status: 'requested' })

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'accepted') {
        return Promise.resolve(jsonResponse({ rides: [accepted] }))
      }
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'requested') {
        return Promise.resolve(jsonResponse({ rides: [requested] }))
      }
      if (url.pathname === '/api/rides/9') return Promise.resolve(jsonResponse({ ride: accepted }))
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/')

  expect(await screen.findByRole('heading', { name: 'Ride status' })).toBeVisible()
  expect(await screen.findByText('accepted')).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Back to booking' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Book a ride' })).not.toBeInTheDocument()
})

it('sends a rider home to a requested ride', async () => {
  const requested = ride({ status: 'requested' })

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'accepted') {
        return Promise.resolve(jsonResponse({ rides: [] }))
      }
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'requested') {
        return Promise.resolve(jsonResponse({ rides: [requested] }))
      }
      if (url.pathname === '/api/rides/9') return Promise.resolve(jsonResponse({ ride: requested }))
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/')

  expect(await screen.findByRole('heading', { name: 'Ride status' })).toBeVisible()
  expect(await screen.findByText('requested')).toBeVisible()
})

it('returns a rider to booking from a completed ride', async () => {
  const user = userEvent.setup()
  const completed = ride({ status: 'completed', completed_at: '2026-11-01T12:00:00Z' })

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (url.pathname === '/api/rides') {
        return Promise.resolve(jsonResponse({ rides: [] }))
      }
      if (url.pathname === '/api/rides/9') return Promise.resolve(jsonResponse({ ride: completed }))
      if (url.pathname === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/rides/9')

  await user.click(await screen.findByRole('link', { name: 'Back to booking' }))
  expect(await screen.findByRole('heading', { name: 'Book a ride' })).toBeVisible()
})

it('returns a rider to booking from a cancelled ride', async () => {
  const cancelled = ride({ status: 'cancelled', cancelled_at: '2026-11-01T12:00:00Z' })

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (url.pathname === '/api/rides/9') return Promise.resolve(jsonResponse({ ride: cancelled }))
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/rides/9')

  expect(await screen.findByRole('link', { name: 'Back to booking' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Cancel ride' })).not.toBeInTheDocument()
})

it('shows a retry when the ongoing-ride lookup fails', async () => {
  const user = userEvent.setup()
  let fail = true

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: rider }))
      if (url.pathname === '/api/rides') {
        return fail
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(jsonResponse({ rides: [] }))
      }
      if (url.pathname === '/api/drivers') return Promise.resolve(jsonResponse({ drivers: [] }))
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/')

  expect(await screen.findByText('Could not reach HailRyde. Check your connection and try again.')).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Book a ride' })).not.toBeInTheDocument()

  fail = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('heading', { name: 'Book a ride' })).toBeVisible()
})

it('sends a driver with an accepted ride to that ride and home after complete', async () => {
  const user = userEvent.setup()
  const assigned = ride({
    status: 'accepted',
    driver: {
      id: 2,
      name: 'Bilal Ahmed',
      phone: '03000000002',
      plate: 'LEA-1001',
      category: 'economy',
      lat: '33.561778',
      lng: '73.148275',
    },
  })
  let completed = false

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: driver }))
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'accepted') {
        return Promise.resolve(jsonResponse({ rides: completed ? [] : [assigned] }))
      }
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'requested') {
        return Promise.resolve(jsonResponse({ rides: [] }))
      }
      if (url.pathname === '/api/rides/9/complete') {
        completed = true
        return Promise.resolve(jsonResponse({ ride: { ...assigned, status: 'completed', completed_at: '2026-11-01T12:00:00Z' } }))
      }
      if (url.pathname === '/api/rides/9') return Promise.resolve(jsonResponse({ ride: assigned }))
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/drive')

  await user.click(await screen.findByRole('button', { name: 'Complete' }))
  await user.click(await screen.findByRole('link', { name: 'Back to the driver desk' }))
  expect(await screen.findByRole('heading', { name: 'Driver desk' })).toBeVisible()
})

function captureThreeSecondPolls() {
  const intervals: Array<() => void> = []
  const realSetInterval = window.setInterval.bind(window)
  vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay === 3000 && typeof handler === 'function') {
      intervals.push(handler as () => void)
      return 0
    }
    return realSetInterval(handler, delay, ...args)
  }) as typeof window.setInterval)
  return intervals
}

it('updates the driver desk from later request polls', async () => {
  const intervals = captureThreeSecondPolls()
  const available = {
    ...driver,
    driver_profile: { ...driver.driver_profile, status: 'available' as const },
  }
  const incoming = ride({ id: 11 })
  let requested: Ride[] = []
  let failPoll = false

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: available }))
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'accepted') {
        return Promise.resolve(jsonResponse({ rides: [] }))
      }
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'requested') {
        return failPoll
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(jsonResponse({ rides: requested }))
      }
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/drive')

  expect(await screen.findByText('No requested rides.')).toBeVisible()
  await waitFor(() => expect(intervals).toHaveLength(1))

  requested = [incoming]
  await act(async () => {
    intervals[0]()
  })

  expect(await screen.findByRole('button', { name: 'Accept' })).toBeVisible()
  expect(screen.getByText('33.561778, 73.148275 to 33.590000, 73.140000')).toBeVisible()
  expect(screen.queryByText('No requested rides.')).not.toBeInTheDocument()

  failPoll = true
  await act(async () => {
    intervals[0]()
  })

  expect(await screen.findByText('Could not reach HailRyde. Check your connection and try again.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Accept' })).toBeVisible()

  failPoll = false
  requested = []
  await act(async () => {
    intervals[0]()
  })

  expect(await screen.findByText('No requested rides.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
  expect(screen.queryByText('Could not reach HailRyde. Check your connection and try again.')).not.toBeInTheDocument()
})

it('removes a request immediately when another driver already accepted it', async () => {
  const user = userEvent.setup()
  captureThreeSecondPolls()
  const available = {
    ...driver,
    driver_profile: { ...driver.driver_profile, status: 'available' as const },
  }
  const incoming = ride({ id: 11 })

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input)
      if (url.pathname === '/api/me') return Promise.resolve(jsonResponse({ user: available }))
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'accepted') {
        return Promise.resolve(jsonResponse({ rides: [] }))
      }
      if (url.pathname === '/api/rides' && url.searchParams.get('status') === 'requested') {
        return Promise.resolve(jsonResponse({ rides: [incoming] }))
      }
      if (url.pathname === '/api/rides/11/accept' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              error: {
                code: 'invalid_transition',
                message: 'The ride cannot make that transition.',
                details: {},
              },
            },
            409,
          ),
        )
      }
      return Promise.reject(new Error(`unmocked ${url.pathname}`))
    }),
  )

  renderAt('/drive')

  await user.click(await screen.findByRole('button', { name: 'Accept' }))

  expect(await screen.findByText('The ride cannot make that transition.')).toBeVisible()
  expect(screen.getByText('No requested rides.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
})
