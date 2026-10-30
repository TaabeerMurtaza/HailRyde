import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { useAuth } from '../use-auth'
import { TextField } from '../components/Field'
import { fieldErrors } from '../field-errors'
import type { ApiError, SessionResponse } from '../types'

export function RegisterPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'rider' | 'driver'>('rider')
  const [plate, setPlate] = useState('')
  const [category, setCategory] = useState<'economy' | 'comfort'>('economy')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const body: Record<string, string> = { name, email, password, phone, role }
    if (role === 'driver') {
      body.plate = plate
      body.category = category
    }

    try {
      const session = await api<SessionResponse>('/api/register', {
        method: 'POST',
        body: JSON.stringify(body),
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
    <AuthCard
      title="Create an account"
      footer={
        <Link to="/login" className="underline">
          Log in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <TextField label="Name" type="text" autoComplete="name" value={name} messages={fieldErrors(error, 'name')} onChange={setName} />
        <TextField label="Email" type="email" autoComplete="email" value={email} messages={fieldErrors(error, 'email')} onChange={setEmail} />
        <TextField label="Password" type="password" autoComplete="new-password" value={password} messages={fieldErrors(error, 'password')} onChange={setPassword} />
        <TextField label="Phone" type="tel" autoComplete="tel" value={phone} messages={fieldErrors(error, 'phone')} onChange={setPhone} />
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Role</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="role" value="rider" checked={role === 'rider'} onChange={() => setRole('rider')} />
              Rider
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="role" value="driver" checked={role === 'driver'} onChange={() => setRole('driver')} />
              Driver
            </label>
          </div>
        </fieldset>
        {role === 'driver' ? (
          <>
            <TextField label="Plate" type="text" autoComplete="off" value={plate} messages={fieldErrors(error, 'plate')} onChange={setPlate} />
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Category</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="category" value="economy" checked={category === 'economy'} onChange={() => setCategory('economy')} />
                  Economy
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="category" value="comfort" checked={category === 'comfort'} onChange={() => setCategory('comfort')} />
                  Comfort
                </label>
              </div>
              {fieldErrors(error, 'category').map((message) => (
                <span key={message} className="mt-1 block text-sm text-red-800">
                  {message}
                </span>
              ))}
            </fieldset>
          </>
        ) : null}
        {error && Object.keys(error.details).length === 0 ? <p className="text-sm text-red-800">{error.message}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="w-full rounded-md bg-stone-950 px-4 py-2 font-medium text-amber-300 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  )
}

function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{title}</h1>
      {children}
      <p className="mt-4 text-sm">{footer}</p>
    </section>
  )
}
