import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from './api'
import type { AuthUser } from './types'
import { AuthContext, type AuthContextValue } from './use-auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(() => getToken() === null)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      navigate('/login', { replace: true })
    })
  }, [navigate])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      return
    }

    let cancelled = false

    api<{ user: AuthUser }>('/api/me')
      .then((body) => {
        if (!cancelled) {
          setUser(body.user)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      setSession(token, nextUser) {
        setToken(token)
        setUser(nextUser)
        setReady(true)
      },
      async logout() {
        try {
          await api<void>('/api/logout', { method: 'POST' })
        } finally {
          clearToken()
          setUser(null)
          navigate('/login', { replace: true })
        }
      },
    }),
    [navigate, ready, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

