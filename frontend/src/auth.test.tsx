import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('maplibre-gl', () => {
  class Map {
    on() {
      return this
    }
    off() {
      return this
    }
    getSource() {
      return undefined
    }
    remove() {}
  }

  class Marker {
    setLngLat() {
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

  return { Map, Marker }
})

const rider = {
  id: 1,
  name: 'Ayesha Khan',
  email: 'ayesha@example.com',
  phone: '03000000001',
  role: 'rider',
  driver_profile: null,
}

const driver = {
  id: 2,
  name: 'Bilal Ahmed',
  email: 'bilal@example.com',
  phone: '03000000002',
  role: 'driver',
  driver_profile: {
    plate: 'LEA-1001',
    category: 'economy',
    status: 'available',
    lat: '31.520400',
    lng: '74.358700',
  },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
})

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('unmocked fetch'))),
  )
})

it('shows plate and category only when the role is driver', async () => {
  const user = userEvent.setup()
  renderAt('/register')

  expect(screen.queryByLabelText('Plate')).not.toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: 'Economy' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'Driver' }))

  expect(screen.getByLabelText('Plate')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Economy' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Comfort' })).toBeInTheDocument()
})

it('shows field errors from the API and keeps the submit button usable', async () => {
  const user = userEvent.setup()
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(
      {
        error: {
          code: 'validation_error',
          message: 'The given data was invalid.',
          details: { email: ['The email has already been taken.'] },
        },
      },
      422,
    ),
  )
  renderAt('/register')

  await user.type(screen.getByLabelText('Name'), 'Ayesha Khan')
  await user.type(screen.getByLabelText('Email'), 'ayesha@example.com')
  await user.type(screen.getByLabelText('Password'), 'password')
  await user.type(screen.getByLabelText('Phone'), '03000000001')
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText('The email has already been taken.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
})

it('disables register while the request is in flight and sends a rider home', async () => {
  const user = userEvent.setup()
  let resolveRegister: (response: Response) => void = () => {}
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRegister = resolve
      }),
  )
  renderAt('/register')

  await user.type(screen.getByLabelText('Name'), 'Ayesha Khan')
  await user.type(screen.getByLabelText('Email'), 'ayesha@example.com')
  await user.type(screen.getByLabelText('Password'), 'password')
  await user.type(screen.getByLabelText('Phone'), '03000000001')
  await user.click(screen.getByRole('radio', { name: 'Rider' }))
  const submitted = user.click(screen.getByRole('button', { name: 'Create account' }))

  const busy = await screen.findByRole('button', { name: 'Creating account…' })
  expect(busy).toBeDisabled()

  resolveRegister(jsonResponse({ token: 'rider-token', user: rider }, 201))
  await submitted

  expect(await screen.findByRole('heading', { name: 'Book a ride' })).toBeVisible()
  expect(localStorage.getItem('hailryde.token')).toBe('rider-token')

  const [, init] = vi.mocked(fetch).mock.calls[0]
  const body = JSON.parse(String(init?.body))
  expect(body).toMatchObject({
    name: 'Ayesha Khan',
    email: 'ayesha@example.com',
    password: 'password',
    phone: '03000000001',
    role: 'rider',
  })
  expect(body.plate).toBeUndefined()
  expect(body.category).toBeUndefined()
})

it('sends a driver to the driver desk after register', async () => {
  const user = userEvent.setup()
  vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'driver-token', user: driver }, 201))
  renderAt('/register')

  await user.type(screen.getByLabelText('Name'), 'Bilal Ahmed')
  await user.type(screen.getByLabelText('Email'), 'bilal@example.com')
  await user.type(screen.getByLabelText('Password'), 'password')
  await user.type(screen.getByLabelText('Phone'), '03000000002')
  await user.click(screen.getByRole('radio', { name: 'Driver' }))
  await user.type(screen.getByLabelText('Plate'), 'LEA-1001')
  await user.click(screen.getByRole('radio', { name: 'Economy' }))
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('heading', { name: 'Driver desk' })).toBeVisible()
  const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
  expect(body).toMatchObject({ role: 'driver', plate: 'LEA-1001', category: 'economy' })
})

it('shows the login error and sends a rider home after login', async () => {
  const user = userEvent.setup()
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(
      {
        error: {
          code: 'invalid_credentials',
          message: 'These credentials do not match our records.',
          details: {},
        },
      },
      401,
    ),
  )
  renderAt('/login')

  await user.type(screen.getByLabelText('Email'), 'ayesha@example.com')
  await user.type(screen.getByLabelText('Password'), 'wrong-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('These credentials do not match our records.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Signing in…' })).not.toBeInTheDocument()

  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ token: 'rider-token', user: rider }))
  await user.clear(screen.getByLabelText('Password'))
  await user.type(screen.getByLabelText('Password'), 'password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Book a ride' })).toBeVisible()
})

it('sends signed-out visitors to login', async () => {
  renderAt('/drive')

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible()
})

it('shows a forbidden message when a signed-in user opens the other role screen', async () => {
  const user = userEvent.setup()
  localStorage.setItem('hailryde.token', 'driver-token')
  vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: driver }))
  renderAt('/')

  expect(await screen.findByText("You can't open this screen with your account.")).toBeVisible()
  await user.click(screen.getByRole('link', { name: 'Back to the driver desk' }))
  expect(await screen.findByRole('heading', { name: 'Driver desk' })).toBeVisible()
})

it('clears the token and shows login when the session is rejected', async () => {
  localStorage.setItem('hailryde.token', 'stale-token')
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(
      { error: { code: 'unauthenticated', message: 'Unauthenticated.', details: {} } },
      401,
    ),
  )
  renderAt('/')

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible()
  await waitFor(() => {
    expect(localStorage.getItem('hailryde.token')).toBeNull()
  })
})
