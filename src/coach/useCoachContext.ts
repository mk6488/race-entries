import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import type { CoachContext } from './coachContext'
import { loadCoachProfileByUid, setCachedCoachContext, touchCurrentDevice } from './coachContext'
import { auth, authReady, db } from '../firebase'

type UseCoachContext = {
  ctx: CoachContext
  refresh: () => Promise<void>
  touch: (params?: { deviceLabel?: string }) => Promise<void>
}

const initial: CoachContext = {
  status: 'authLoading',
  authStatus: 'loading',
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
let deviceUnsub: (() => void) | null = null
let deviceUid: string | null = null
let deviceSnapReceived = false
let lastDeviceCoachId: string | null = null

type DeviceDoc = { coachId?: unknown }

function stopDeviceSub() {
  if (deviceUnsub) deviceUnsub()
  deviceUnsub = null
  deviceUid = null
  deviceSnapReceived = false
  lastDeviceCoachId = null
}

function ensureDeviceSub(uid: string) {
  if (deviceUnsub && deviceUid === uid) return
  stopDeviceSub()
  deviceUid = uid
  deviceSnapReceived = false
  lastDeviceCoachId = null

  const path = `devices/${uid}`
  if (import.meta.env.DEV) {
    console.info('[coach] device sub:start', { path })
  }

  deviceUnsub = onSnapshot(
    doc(db, 'devices', uid),
    async (snap) => {
      deviceSnapReceived = true

      if (!snap.exists()) {
        lastDeviceCoachId = null
        setCachedCoachContext({ coachId: null, coachName: null })
        emit({
          status: 'signedInUnlinked',
          authStatus: 'signedIn',
          uid,
          coachId: null,
          coachName: null,
          isLinked: false,
          loading: false,
        })
        if (import.meta.env.DEV) {
          console.info('[coach] device sub:snap', { path, exists: false })
        }
        return
      }

      if (import.meta.env.DEV) {
        console.info('[coach] device sub:snap', { path, exists: true })
      }

      const data = (snap.data() as DeviceDoc) || {}
      const coachId = typeof data.coachId === 'string' && data.coachId ? data.coachId : null
      lastDeviceCoachId = coachId

      if (!coachId) {
        setCachedCoachContext({ coachId: null, coachName: null })
        emit({
          status: 'signedInUnlinked',
          authStatus: 'signedIn',
          uid,
          coachId: null,
          coachName: null,
          isLinked: false,
          loading: false,
        })
        return
      }

      // Device is linked; load coach profile doc (usually coaches/{uid}).
      const reqId = ++profileReqId
      emit({
        status: 'signedInProfileLoading',
        authStatus: 'signedIn',
        uid,
        coachId: null,
        coachName: null,
        isLinked: false,
        loading: true,
      })
      try {
        const res = await loadCoachProfileByUid(coachId)
        if (reqId !== profileReqId) return
        if (!res.exists) {
          emit({
            status: 'signedInError',
            authStatus: 'signedIn',
            uid,
            coachId: null,
            coachName: null,
            isLinked: false,
            loading: false,
            error: 'Coach profile missing.',
          })
          return
        }
        setCachedCoachContext({ coachId: res.coachId, coachName: res.coachName })
        emit({
          status: 'signedInLinked',
          authStatus: 'signedIn',
          uid,
          coachId: res.coachId,
          coachName: res.coachName,
          isLinked: true,
          loading: false,
        })
      } catch (err: unknown) {
        if (reqId !== profileReqId) return
        if (import.meta.env.DEV) {
          const anyErr = err as { code?: unknown; message?: unknown }
          console.warn('[coach] coach profile load failed', {
            uid,
            coachId,
            code: typeof anyErr?.code === 'string' ? anyErr.code : undefined,
            message: typeof anyErr?.message === 'string' ? anyErr.message : undefined,
            err,
          })
        }
        emit({
          status: 'signedInError',
          authStatus: 'signedIn',
          uid,
          coachId: null,
          coachName: null,
          isLinked: false,
          loading: false,
          error: 'Failed to load coach identity.',
        })
      }
    },
    (err) => {
      deviceSnapReceived = true
      if (import.meta.env.DEV) {
        const anyErr = err as { code?: unknown; message?: unknown }
        console.warn('[coach] device sub:error', {
          path,
          code: typeof anyErr?.code === 'string' ? anyErr.code : undefined,
          message: typeof anyErr?.message === 'string' ? anyErr.message : undefined,
          err,
        })
      }
      emit({
        status: 'signedInError',
        authStatus: 'signedIn',
        uid,
        coachId: null,
        coachName: null,
        isLinked: false,
        loading: false,
        error: 'Failed to load coach identity.',
      })
    },
  )
}

function emit(next: CoachContext) {
  shared = next
  listeners.forEach((fn) => fn(shared))
}

async function refreshShared() {
  if (refreshInFlight) return refreshInFlight
  // If auth is not hydrated yet, avoid jumping to unlinked/error states.
  if (!authHydrated) {
    emit({ ...shared, status: 'authLoading', authStatus: 'loading', loading: true, error: undefined })
  } else {
    const uid = auth.currentUser?.uid ?? null
    if (!uid) {
      emit({ ...shared, status: 'signedOut', authStatus: 'signedOut', uid: null, coachId: null, coachName: null, isLinked: false, loading: false, error: undefined })
    } else {
      // Wait for device snapshot before deciding "unlinked".
      emit({ ...shared, status: 'signedInProfileLoading', authStatus: 'signedIn', uid, coachId: null, coachName: null, isLinked: false, loading: true, error: undefined })
    }
  }
  refreshInFlight = (async () => {
    if (!authHydrated) {
      // If a refresh is requested before our authReady handler runs (e.g. immediately after onboarding),
      // wait for auth hydration so we don't incorrectly show "unlinked" or "error".
      await authReady.catch(() => {})
      authHydrated = true
      if (import.meta.env.DEV) {
        console.info('[coach] auth hydrated (via refresh)', { uid: auth.currentUser?.uid ?? null })
      }
    }
    const uid = auth.currentUser?.uid ?? null
    if (!uid) {
      // Signed out (or anonymous sign-in failed).
      setCachedCoachContext({ coachId: null, coachName: null })
      stopDeviceSub()
      emit({ status: 'signedOut', authStatus: 'signedOut', uid: null, coachId: null, coachName: null, isLinked: false, loading: false })
      return
    }

    ensureDeviceSub(uid)

    // Optional: explicit refresh also re-reads coach doc if we already know a coachId.
    if (deviceSnapReceived && lastDeviceCoachId) {
      const coachId = lastDeviceCoachId
      const reqId = ++profileReqId
      emit({ status: 'signedInProfileLoading', authStatus: 'signedIn', uid, coachId: null, coachName: null, isLinked: false, loading: true })
      try {
        const res = await loadCoachProfileByUid(coachId)
        if (reqId !== profileReqId) return
        if (!res.exists) {
          emit({ status: 'signedInError', authStatus: 'signedIn', uid, coachId: null, coachName: null, isLinked: false, loading: false, error: 'Coach profile missing.' })
          return
        }
        setCachedCoachContext({ coachId: res.coachId, coachName: res.coachName })
        emit({ status: 'signedInLinked', authStatus: 'signedIn', uid, coachId: res.coachId, coachName: res.coachName, isLinked: true, loading: false })
      } catch {
        emit({ status: 'signedInError', authStatus: 'signedIn', uid, coachId: null, coachName: null, isLinked: false, loading: false, error: 'Failed to load coach identity.' })
      }
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
        if (import.meta.env.DEV) {
          const u = auth.currentUser
          console.info('[coach] auth changed', { uid: u?.uid ?? null, isAnonymous: u?.isAnonymous ?? false })
        }
        const nextUid = auth.currentUser?.uid ?? null
        if (nextUid && deviceUid !== nextUid) {
          ensureDeviceSub(nextUid)
        }
        if (!nextUid) {
          stopDeviceSub()
        }
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
        stopDeviceSub()
      }
    }
  }, [])

  return useMemo(() => ({ ctx, refresh, touch }), [ctx, refresh, touch])
}

