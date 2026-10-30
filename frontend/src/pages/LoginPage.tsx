import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { useAuth } from '../use-auth'
import { TextField } from '../components/Field'
import { fieldErrors } from '../field-errors'
import type { ApiError, SessionResponse } from '../types'

export function LoginPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const session = await api<SessionResponse>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setSession(session.token, session.user)
      navigate(session.user.role === 'driver' ? '/drive' : '/')
    } catch (caught) {
      setError(caught as ApiError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Log in</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        <TextField label="Email" type="email" autoComplete="email" value={email} messages={fieldErrors(error, 'email')} onChange={setEmail} />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} messages={fieldErrors(error, 'password')} onChange={setPassword} />
        {error ? <p className="text-sm text-red-800">{error.message}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="w-full rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/register" className="underline">
          Create an account
        </Link>
      </p>
    </section>
  )
}
