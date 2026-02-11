import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CoachContext } from './coachContext'
import { loadCoachContext, touchCurrentDevice } from './coachContext'

type UseCoachContext = {
  ctx: CoachContext
  refresh: () => Promise<void>
  touch: (params?: { deviceLabel?: string }) => Promise<void>
}

const initial: CoachContext = {
  uid: null,
  coachId: null,
  coachName: null,
  isLinked: false,
  loading: true,
}

let shared: CoachContext = initial
const listeners = new Set<(c: CoachContext) => void>()
let refreshInFlight: Promise<void> | null = null
let touchIntervalId: number | null = null

function emit(next: CoachContext) {
  shared = next
  listeners.forEach((fn) => fn(shared))
}

async function refreshShared() {
  if (refreshInFlight) return refreshInFlight
  emit({ ...shared, loading: true, error: undefined })
  refreshInFlight = (async () => {
    const next = await loadCoachContext()
    if (import.meta.env.DEV) {
      // Minimal diagnostics; no PIN and no Firestore payloads.
      console.log('[coach] context', { uid: next.uid, coachId: next.coachId, coachName: next.coachName, isLinked: next.isLinked })
    }
    emit({ ...next, loading: false })
  })().finally(() => { refreshInFlight = null })
  return refreshInFlight
}

function ensureTouchInterval() {
  if (touchIntervalId != null) return
  const intervalMs = 20 * 60 * 1000
  void touchCurrentDevice()
  touchIntervalId = window.setInterval(() => { void touchCurrentDevice() }, intervalMs)
}

function maybeStopTouchInterval() {
  if (listeners.size > 0) return
  if (touchIntervalId != null) {
    window.clearInterval(touchIntervalId)
    touchIntervalId = null
  }
}

export function useCoachContext(): UseCoachContext {
  const [ctx, setCtx] = useState<CoachContext>(shared)

  const refresh = useCallback(async () => {
    await refreshShared()
  }, [])

  const touch = useCallback(async (params?: { deviceLabel?: string }) => {
    await touchCurrentDevice(params)
  }, [])

  useEffect(() => {
    listeners.add(setCtx)
    setCtx(shared)
    ensureTouchInterval()
    void refreshShared()
    return () => {
      listeners.delete(setCtx)
      maybeStopTouchInterval()
    }
  }, [])

  return useMemo(() => ({ ctx, refresh, touch }), [ctx, refresh, touch])
}

