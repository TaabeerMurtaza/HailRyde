import { createContext, useContext } from 'react'
import type { AuthUser } from './types'

export type AuthContextValue = {
  user: AuthUser | null
  ready: boolean
  setSession: (token: string, user: AuthUser) => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return value
}
