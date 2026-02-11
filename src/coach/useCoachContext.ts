import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { CoachContext } from './coachContext'
import { getCachedCoachContext, loadCoachProfileByUid, setCachedCoachContext, touchCurrentDevice } from './coachContext'
import { auth, authReady } from '../firebase'

type UseCoachContext = {
  ctx: CoachContext
  refresh: () => Promise<void>
  touch: (params?: { deviceLabel?: string }) => Promise<void>
}

const initial: CoachContext = {
  status: 'authLoading',
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
let authUnsub: (() => void) | null = null
let authHydrated = false
let profileReqId = 0

function emit(next: CoachContext) {
  shared = next
  listeners.forEach((fn) => fn(shared))
}

async function refreshShared() {
  if (refreshInFlight) return refreshInFlight
  // If auth is not hydrated yet, avoid jumping to unlinked/error states.
  if (!authHydrated) {
    emit({ ...shared, status: 'authLoading', loading: true, error: undefined })
  } else if (!shared.uid) {
    emit({ ...shared, status: 'signedOut', loading: false, error: undefined })
  } else {
    emit({ ...shared, status: 'signedInProfileLoading', loading: true, error: undefined })
  }
  refreshInFlight = (async () => {
    if (!authHydrated) return
    const uid = auth.currentUser?.uid ?? null
    if (!uid) {
      // Signed out (or anonymous sign-in failed).
      setCachedCoachContext({ coachId: null, coachName: null })
      emit({ status: 'signedOut', uid: null, coachId: null, coachName: null, isLinked: false, loading: false })
      return
    }

    const reqId = ++profileReqId
    emit({ status: 'signedInProfileLoading', uid, coachId: null, coachName: null, isLinked: false, loading: true })
    try {
      const res = await loadCoachProfileByUid(uid)
      if (reqId !== profileReqId) return

      if (!res.exists) {
        setCachedCoachContext({ coachId: null, coachName: null })
        emit({ status: 'signedInUnlinked', uid, coachId: null, coachName: null, isLinked: false, loading: false })
        return
      }

      setCachedCoachContext({ coachId: res.coachId, coachName: res.coachName })
      emit({
        status: 'signedInLinked',
        uid,
        coachId: res.coachId,
        coachName: res.coachName,
        isLinked: true,
        loading: false,
      })
    } catch (err: unknown) {
      if (reqId !== profileReqId) return
      if (import.meta.env.DEV) {
        // Do not include Firestore payloads; just the exception object.
        console.warn('[coach] identity load failed', { uid, err })
      }
      const cached = getCachedCoachContext()
      if (cached.coachId) {
        // Keep last known link, but surface the error state so UI can show a distinct label.
        emit({
          status: 'signedInError',
          uid,
          coachId: cached.coachId,
          coachName: cached.coachName,
          isLinked: true,
          loading: false,
          error: 'Failed to refresh coach identity.',
        })
        return
      }
      emit({
        status: 'signedInError',
        uid,
        coachId: null,
        coachName: null,
        isLinked: false,
        loading: false,
        error: 'Failed to load coach identity.',
      })
    }
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
    if (!authUnsub) {
      // We only start producing non-loading identity states once authReady has run.
      // This avoids showing "unlinked" / "identity error" during auth hydration.
      void authReady.then(() => {
        authHydrated = true
        if (import.meta.env.DEV) {
          console.info('[coach] auth hydrated', { uid: auth.currentUser?.uid ?? null })
        }
        void refreshShared()
      })
      authUnsub = onAuthStateChanged(auth, () => {
        if (!authHydrated) return
        void refreshShared()
      })
    }
    return () => {
      listeners.delete(setCtx)
      maybeStopTouchInterval()
      if (listeners.size === 0 && authUnsub) {
        authUnsub()
        authUnsub = null
        authHydrated = false
      }
    }
  }, [])

  return useMemo(() => ({ ctx, refresh, touch }), [ctx, refresh, touch])
}

