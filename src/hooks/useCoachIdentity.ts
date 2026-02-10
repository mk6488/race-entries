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

export function useCoachIdentity(refreshKey = 0): CoachIdentityState {
  const [state, setState] = useState<CoachIdentityState>({
    status: 'loading',
    uid: null,
    coach: null,
    needsOnboarding: false,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setState({ status: 'loading', uid: null, coach: null, needsOnboarding: false, error: null })
      try {
        await authReady
        const uid = auth.currentUser?.uid ?? null
        if (!uid) {
          if (!cancelled) {
            setState({ status: 'ready', uid: null, coach: null, needsOnboarding: true, error: null })
          }
          return
        }

        const device = await getDeviceLink(uid)
        if (!device) {
          if (!cancelled) {
            setState({ status: 'ready', uid, coach: null, needsOnboarding: true, error: null })
          }
          return
        }

        const coach = await getCoach(device.coachId)
        if (!coach) {
          if (!cancelled) {
            setState({ status: 'ready', uid, coach: null, needsOnboarding: true, error: null })
          }
          return
        }

        if (!cancelled) {
          setState({ status: 'ready', uid, coach, needsOnboarding: false, error: null })
        }
        void touchDevice().catch(() => {})
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            uid: auth.currentUser?.uid ?? null,
            coach: null,
            needsOnboarding: true,
            error: toErrorMessage(err),
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return state
}
