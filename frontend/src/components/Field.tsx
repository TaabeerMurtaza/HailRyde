import type { ReactNode } from 'react'

export function Field({
  label,
  children,
  messages,
}: {
  label: string
  children: ReactNode
  messages: string[]
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {messages.map((message) => (
        <span key={message} className="mt-1 block text-sm text-red-800">
          {message}
        </span>
      ))}
    </label>
  )
}

export function TextField({
  label,
  type,
  value,
  autoComplete,
  messages,
  onChange,
}: {
  label: string
  type: string
  value: string
  autoComplete: string
  messages: string[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} messages={messages}>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={messages.length > 0}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-900"
      />
    </Field>
  )
}
