import { Timestamp } from 'firebase/firestore'
import { logWarn } from '../utils/log'

function maybeWarn(warnOnInvalid: boolean, scope: string, value: unknown) {
  if (!warnOnInvalid) return
  logWarn(scope, { value })
}

export function asRecord(value: unknown, warnOnInvalid = false): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  maybeWarn(warnOnInvalid, 'asRecord', value)
  return {}
}

export function asString(value: unknown, fallback = '', warnOnInvalid = false): string {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return value
  try {
    return String(value)
  } catch (err) {
    maybeWarn(warnOnInvalid, 'asString', value)
    return fallback
  }
}

export function asNumber(value: unknown, fallback: number | null | undefined = null, warnOnInvalid = false): number | null | undefined {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
  maybeWarn(warnOnInvalid, 'asNumber', value)
  return fallback
}

export function asBool<T extends boolean | undefined = boolean>(value: unknown, fallback: T = false as T, warnOnInvalid = false): boolean | T {
  if (typeof value === 'boolean') return value
  maybeWarn(warnOnInvalid, 'asBool', value)
  return fallback
}

export function asStringArray(value: unknown, fallback: string[] = [], warnOnInvalid = false): string[] {
  if (!Array.isArray(value)) {
    maybeWarn(warnOnInvalid, 'asStringArray', value)
    return fallback
  }
  return value.map((v) => asString(v, '', warnOnInvalid))
}

export function asDateFromTimestampLike(value: unknown, warnOnInvalid = false): Date | null {
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
  maybeWarn(warnOnInvalid, 'asDateFromTimestampLike', value)
  return null
}

export function withId<T>(id: string, obj: T): T & { id: string } {
  return { id, ...obj }
}
