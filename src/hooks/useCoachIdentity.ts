import { useEffect, useState } from 'react'
import { auth, authReady } from '../firebase'
import { getCoach, getDeviceLink, touchDevice, type CoachProfile } from '../identity/coachIdentity'
import { toErrorMessage } from '../utils/errors'

type CoachIdentityState = {
  status: 'loading' | 'ready' | 'error'
  uid: string | null
  coach: CoachProfile | null
  needsOnboarding: boolean
  error: string | null
}

const initialState: CoachIdentityState = {
  status: 'loading',
  uid: null,
  coach: null,
  needsOnboarding: false,
  error: null,
}

let cachedIdentity: CoachIdentityState | null = null
let identityPromise: Promise<CoachIdentityState> | null = null
let touchSent = false

function logDev(message: string, data?: unknown) {
  if (import.meta.env.PROD) return
  if (data !== undefined) {
    console.info(message, data)
    return
  }
  console.info(message)
}

async function resolveIdentityOnce(forceRefresh = false): Promise<CoachIdentityState> {
  if (!forceRefresh && cachedIdentity && cachedIdentity.status !== 'loading') {
    return cachedIdentity
  }
  if (!forceRefresh && identityPromise) {
    return identityPromise
  }

  identityPromise = (async () => {
    try {
      await authReady
      const uid = auth.currentUser?.uid ?? null
      if (!uid) {
        const result: CoachIdentityState = { status: 'ready', uid: null, coach: null, needsOnboarding: true, error: null }
        cachedIdentity = result
        logDev('Identity requires onboarding')
        return result
      }

      const device = await getDeviceLink(uid)
      if (!device) {
        const result: CoachIdentityState = { status: 'ready', uid, coach: null, needsOnboarding: true, error: null }
        cachedIdentity = result
        logDev('Identity requires onboarding')
        return result
      }

      const coach = await getCoach(device.coachId)
      if (!coach) {
        const result: CoachIdentityState = { status: 'ready', uid, coach: null, needsOnboarding: true, error: null }
        cachedIdentity = result
        logDev('Identity requires onboarding')
        return result
      }

      const result: CoachIdentityState = { status: 'ready', uid, coach, needsOnboarding: false, error: null }
      cachedIdentity = result
      logDev('Identity resolved', { uid, coachId: coach.coachId })
      if (!touchSent) {
        touchSent = true
        void touchDevice().catch(() => {})
      }
      return result
    } catch (err) {
      const result: CoachIdentityState = {
        status: 'error',
        uid: auth.currentUser?.uid ?? null,
        coach: null,
        needsOnboarding: true,
        error: toErrorMessage(err),
      }
      cachedIdentity = result
      return result
    } finally {
      identityPromise = null
    }
  })()

  return identityPromise
}

export function useCoachIdentity(refreshKey = 0, enabled = true): CoachIdentityState {
  const [state, setState] = useState<CoachIdentityState>({
    ...initialState,
    ...(cachedIdentity && cachedIdentity.status !== 'loading' ? cachedIdentity : {}),
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const forceRefresh = refreshKey > 0
    if (!forceRefresh && cachedIdentity && cachedIdentity.status !== 'loading') {
      setState(cachedIdentity)
      return
    }

    setState(initialState)
    resolveIdentityOnce(forceRefresh).then((result) => {
      if (!cancelled) setState(result)
    })

    return () => {
      cancelled = true
    }
  }, [refreshKey, enabled])

  return state
}
