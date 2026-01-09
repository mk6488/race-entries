import { Timestamp } from 'firebase/firestore'

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function asString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return value
  return String(value)
}

export function asNumber(value: unknown, fallback: number | null | undefined = null): number | null | undefined {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function asBool<T extends boolean | undefined = boolean>(value: unknown, fallback: T = false as T): boolean | T {
  if (typeof value === 'boolean') return value
  return fallback
}

export function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback
  return value.map((v) => asString(v))
}

export function asDateFromTimestampLike(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

export function withId<T>(id: string, obj: T): T & { id: string } {
  return { id, ...obj }
}
