import { Timestamp } from 'firebase/firestore'
import { logWarn } from '../utils/log'

type IssueCtx = {
  issues?: { push: (v: { field?: string; message: string; level?: 'warn' | 'error' }) => void }
  collection?: string
  docId?: string
}

function maybeWarn(warnOnInvalid: boolean, scope: string, value: unknown, ctx?: IssueCtx, field?: string) {
  if (ctx?.issues) {
    ctx.issues.push({ field, message: `${scope}: fallback used`, level: 'warn' })
  }
  if (!warnOnInvalid) return
  logWarn(scope, { value, collection: ctx?.collection, docId: ctx?.docId, field })
}

export function asRecord(value: unknown, warnOnInvalid = false, ctx?: IssueCtx, field?: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  maybeWarn(warnOnInvalid, 'asRecord', value, ctx, field)
  return {}
}

export function asString(value: unknown, fallback = '', warnOnInvalid = false, ctx?: IssueCtx, field?: string): string {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return value
  try {
    return String(value)
  } catch (err) {
    maybeWarn(warnOnInvalid, 'asString', value, ctx, field)
    return fallback
  }
}

export function asNumber(value: unknown, fallback: number | null | undefined = null, warnOnInvalid = false, ctx?: IssueCtx, field?: string): number | null | undefined {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
  maybeWarn(warnOnInvalid, 'asNumber', value, ctx, field)
  return fallback
}

export function asBool<T extends boolean | undefined = boolean>(value: unknown, fallback: T = false as T, warnOnInvalid = false, ctx?: IssueCtx, field?: string): boolean | T {
  if (typeof value === 'boolean') return value
  maybeWarn(warnOnInvalid, 'asBool', value, ctx, field)
  return fallback
}

export function asStringArray(value: unknown, fallback: string[] = [], warnOnInvalid = false, ctx?: IssueCtx, field?: string): string[] {
  if (!Array.isArray(value)) {
    maybeWarn(warnOnInvalid, 'asStringArray', value, ctx, field)
    return fallback
  }
  return value.map((v) => asString(v, '', warnOnInvalid, ctx, field))
}

export function asDateFromTimestampLike(value: unknown, warnOnInvalid = false, ctx?: IssueCtx, field?: string): Date | null {
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
  maybeWarn(warnOnInvalid, 'asDateFromTimestampLike', value, ctx, field)
  return null
}

export function withId<T>(id: string, obj: T): T & { id: string } {
  return { id, ...obj }
}
