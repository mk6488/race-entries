export type TraceEvent = {
  type: string
  scope?: string
  meta?: Record<string, string | number | boolean>
  ts: number
}

const MAX_EVENTS = 100
const buffer: TraceEvent[] = []
const isProd = import.meta.env.PROD

export function trace(event: Omit<TraceEvent, 'ts'> & { ts?: number }) {
  if (isProd && event.type !== 'error') return
  const ev: TraceEvent = { ...event, ts: event.ts ?? Date.now() }
  buffer.push(ev)
  if (buffer.length > MAX_EVENTS) buffer.shift()
  if (!isProd && event.type.startsWith('error')) {
    // Light console visibility in dev only
    // eslint-disable-next-line no-console
    console.warn('[trace]', ev)
  }
}

export function getTrace(): TraceEvent[] {
  return [...buffer].sort((a, b) => a.ts - b.ts)
}

export function clearTrace() {
  buffer.splice(0, buffer.length)
}
