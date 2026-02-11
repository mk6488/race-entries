import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export function useCoachContext(): UseCoachContext {
  const [ctx, setCtx] = useState<CoachContext>(initial)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    setCtx((prev) => ({ ...prev, loading: true, error: undefined }))
    const next = await loadCoachContext()
    if (import.meta.env.DEV) {
      // Minimal diagnostics; no PIN and no Firestore payloads.
      console.log('[coach] context', { uid: next.uid, coachId: next.coachId, coachName: next.coachName, isLinked: next.isLinked })
    }
    if (mountedRef.current) setCtx({ ...next, loading: false })
  }, [])

  const touch = useCallback(async (params?: { deviceLabel?: string }) => {
    await touchCurrentDevice(params)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  // Periodic touch: lightweight liveness ping, best-effort.
  useEffect(() => {
    const intervalMs = 20 * 60 * 1000
    void touch()
    const id = window.setInterval(() => { void touch() }, intervalMs)
    return () => window.clearInterval(id)
  }, [touch])

  return useMemo(() => ({ ctx, refresh, touch }), [ctx, refresh, touch])
}

