import type { ApiError } from './types'

export function fieldErrors(error: ApiError | null, field: string): string[] {
  return error?.details[field] ?? []
}
