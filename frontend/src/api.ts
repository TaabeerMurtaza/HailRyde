import type { ApiError } from './types'

const TOKEN_KEY = 'hailryde.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized = () => {}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL
  return (typeof configured === 'string' && configured.length > 0
    ? configured
    : 'http://localhost:8000'
  ).replace(/\/$/, '')
}

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const error = value as Partial<ApiError>
  return typeof error.code === 'string' && typeof error.message === 'string' && typeof error.details === 'object'
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${apiBase()}${path}`, { ...init, headers })
  } catch {
    throw {
      code: 'network_error',
      message: 'Could not reach HailRyde. Check your connection and try again.',
      details: {},
    } satisfies ApiError
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body = (await response.json().catch(() => null)) as { error?: unknown } | null

  if (!response.ok) {
    const error: ApiError = isApiError(body?.error)
      ? body.error
      : { code: 'request_failed', message: 'Something went wrong.', details: {} }

    if (response.status === 401) {
      clearToken()
      onUnauthorized()
    }

    throw error
  }

  return body as T
}
