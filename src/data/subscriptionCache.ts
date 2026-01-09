import type { Unsubscribe } from 'firebase/firestore'

type Listener<T> = {
  onData: (data: T) => void
  onError?: (err: unknown) => void
}

type Cached<T> = {
  listeners: Set<Listener<T>>
  unsubscribe: Unsubscribe
}

const cache = new Map<string, Cached<any>>()

export function subscribeCached<T>(
  key: string,
  start: (emit: (data: T) => void, emitError: (err: unknown) => void) => Unsubscribe,
  onData: (data: T) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const listener: Listener<T> = { onData, onError }
  const existing = cache.get(key) as Cached<T> | undefined

  if (existing) {
    existing.listeners.add(listener)
    return () => cleanup(key, listener)
  }

  const listeners = new Set<Listener<T>>([listener])
  const unsubscribe = start(
    (data) => {
      listeners.forEach((l) => l.onData(data))
    },
    (err) => {
      listeners.forEach((l) => l.onError?.(err))
    },
  )

  cache.set(key, { listeners, unsubscribe })
  return () => cleanup(key, listener)
}

function cleanup<T>(key: string, listener: Listener<T>) {
  const cached = cache.get(key) as Cached<T> | undefined
  if (!cached) return
  cached.listeners.delete(listener)
  if (cached.listeners.size === 0) {
    cached.unsubscribe()
    cache.delete(key)
  }
}

export function getActiveSubscriptions() {
  return Array.from(cache.entries()).map(([key, value]) => ({ key, listeners: value.listeners.size }))
}
