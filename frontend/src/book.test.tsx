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

const places = [
  { id: 'gulberg', name: 'Gulberg', lat: '31.520400', lng: '74.358700' },
  { id: 'airport', name: 'Allama Iqbal Airport', lat: '31.521600', lng: '74.403600' },
]

const quote = {
  distance_km: '4.26',
  duration_min: 10,
  fare_amount: '391.70',
  currency: 'PKR',
  pickup_eta_min: 3,
}

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

async function chooseTrip(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText('Pickup')
  await user.selectOptions(screen.getByLabelText('Pickup'), 'gulberg')
  await user.selectOptions(screen.getByLabelText('Destination'), 'airport')
  expect(await screen.findByText(/391\.70/)).toBeVisible()
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
  const user = userEvent.setup()
  let resolveCreate: (response: Response) => void = () => {}

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      if (path === '/api/me') {
        return Promise.resolve(jsonResponse({ user: rider }))
      }
      if (path === '/api/places') {
        return Promise.resolve(jsonResponse({ places }))
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
              pickup: places[0],
              destination: places[1],
              distance_km: '4.26',
              duration_min: 10,
              pickup_eta_min: 3,
              fare_amount: '391.70',
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
  await chooseTrip(user)
  await user.click(screen.getByRole('button', { name: 'Request ride' }))

  const busy = await screen.findByRole('button', { name: 'Requesting ride…' })
  expect(busy).toBeVisible()
  expect(busy).toBeDisabled()

  resolveCreate(jsonResponse({ ride: { id: 9 } }, 201))
})

it('shows the error and drops the busy label when create fails', async () => {
  const user = userEvent.setup()

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input)
      if (path === '/api/me') {
        return Promise.resolve(jsonResponse({ user: rider }))
      }
      if (path === '/api/places') {
        return Promise.resolve(jsonResponse({ places }))
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
  await chooseTrip(user)
  await user.click(screen.getByRole('button', { name: 'Request ride' }))

  expect(await screen.findByText('You already have an active ride.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Requesting ride…' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
})
