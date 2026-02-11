import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '../firebase'

export type CoachContext = {
  uid: string | null
  coachId: string | null
  coachName: string | null
  isLinked: boolean
  loading: boolean
  error?: string
}

type DeviceDoc = { coachId?: string; coachName?: string }
type CoachDoc = { name?: string; firstName?: string; lastName?: string }

const COACH_CACHE_KEY = 'coach:context:v1'

export function getCachedCoachContext(): Pick<CoachContext, 'coachId' | 'coachName'> {
  try {
    const raw = localStorage.getItem(COACH_CACHE_KEY)
    if (!raw) return { coachId: null, coachName: null }
    const parsed = JSON.parse(raw) as { coachId?: unknown; coachName?: unknown }
    const coachId = typeof parsed.coachId === 'string' ? parsed.coachId : null
    const coachName = typeof parsed.coachName === 'string' ? parsed.coachName : null
    return { coachId, coachName }
  } catch {
    return { coachId: null, coachName: null }
  }
}

export function setCachedCoachContext(input: { coachId: string | null; coachName: string | null }) {
  try {
    if (!input.coachId) {
      localStorage.removeItem(COACH_CACHE_KEY)
      return
    }
    localStorage.setItem(COACH_CACHE_KEY, JSON.stringify({ coachId: input.coachId, coachName: input.coachName }))
  } catch {
    // ignore
  }
}

export async function loadCoachContext(): Promise<CoachContext> {
  const uid = auth.currentUser?.uid ?? null
  if (!uid) {
    return { uid: null, coachId: null, coachName: null, isLinked: false, loading: false, error: 'Not signed in.' }
  }

  try {
    const deviceSnap = await getDoc(doc(db, 'devices', uid))
    const device = (deviceSnap.exists() ? (deviceSnap.data() as DeviceDoc) : null) || null
    const coachId = typeof device?.coachId === 'string' && device.coachId ? device.coachId : null
    if (!coachId) {
      setCachedCoachContext({ coachId: null, coachName: null })
      return { uid, coachId: null, coachName: null, isLinked: false, loading: false }
    }

    let coachName: string | null = null
    const coachSnap = await getDoc(doc(db, 'coaches', coachId))
    if (coachSnap.exists()) {
      const coach = coachSnap.data() as CoachDoc
      if (typeof coach.name === 'string' && coach.name.trim()) coachName = coach.name.trim()
      else {
        const first = typeof coach.firstName === 'string' ? coach.firstName.trim() : ''
        const last = typeof coach.lastName === 'string' ? coach.lastName.trim() : ''
        const combined = `${first} ${last}`.trim()
        coachName = combined || null
      }
    }

    setCachedCoachContext({ coachId, coachName })
    return { uid, coachId, coachName, isLinked: true, loading: false }
  } catch (err) {
    const cached = getCachedCoachContext()
    // If we have a cached coachId/name, prefer returning it rather than blocking the app.
    if (cached.coachId) {
      return { uid, coachId: cached.coachId, coachName: cached.coachName, isLinked: true, loading: false, error: 'Failed to refresh coach identity.' }
    }
    return { uid, coachId: null, coachName: null, isLinked: false, loading: false, error: 'Failed to load coach identity.' }
  }
}

export async function touchCurrentDevice(params?: { deviceLabel?: string }) {
  try {
    const call = httpsCallable(functions, 'touchDevice')
    await call({ deviceLabel: params?.deviceLabel })
  } catch {
    // Swallow failures (do not break app usage)
  }
}

