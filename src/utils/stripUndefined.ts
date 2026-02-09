import type { UpdateData } from 'firebase/firestore'

export function stripUndefined<T extends Record<string, unknown>>(input: T): UpdateData<T> {
  const out: Record<string, unknown> = {}
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      out[key] = value
    }
  })
  return out as UpdateData<T>
}
