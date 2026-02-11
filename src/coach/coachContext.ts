import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { touchDevice, logCallableError } from '../firebase/functions'

export type CoachIdentityStatus =
  | 'authLoading'
  | 'signedOut'
  | 'signedInProfileLoading'
  | 'signedInUnlinked'
  | 'signedInLinked'
  | 'signedInError'

export type CoachContext = {
  status: CoachIdentityStatus
  uid: string | null
  coachId: string | null
  coachName: string | null
  isLinked: boolean
  loading: boolean
  error?: string
}

type CoachDoc = {
  uid?: string
  displayName?: string
  email?: string | null
  name?: string
  firstName?: string
  lastName?: string
}

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

export type CoachProfileLoadResult =
  | { exists: false; coachId: null; coachName: null }
  | { exists: true; coachId: string; coachName: string | null }

export async function loadCoachProfileByUid(uid: string): Promise<CoachProfileLoadResult> {
  let coachName: string | null = null
  const coachPath = `coaches/${uid}`
  if (import.meta.env.DEV) {
    console.info('[coach] read', { path: coachPath })
  }

  const coachSnap = await getDoc(doc(db, 'coaches', uid))
  if (!coachSnap.exists()) {
    if (import.meta.env.DEV) {
      console.info('[coach] result', { path: coachPath, exists: false })
    }
    return { exists: false, coachId: null, coachName: null }
  }

  const coach = coachSnap.data() as CoachDoc
  if (typeof coach.displayName === 'string' && coach.displayName.trim()) coachName = coach.displayName.trim()
  else if (typeof coach.name === 'string' && coach.name.trim()) coachName = coach.name.trim()
  else {
    const first = typeof coach.firstName === 'string' ? coach.firstName.trim() : ''
    const last = typeof coach.lastName === 'string' ? coach.lastName.trim() : ''
    const combined = `${first} ${last}`.trim()
    coachName = combined || null
  }

  if (import.meta.env.DEV) {
    console.info('[coach] result', { path: coachPath, exists: true, coachName })
  }

  return { exists: true, coachId: uid, coachName }
}

export async function touchCurrentDevice(params?: { deviceLabel?: string }) {
  try {
    await touchDevice({ deviceLabel: params?.deviceLabel })
  } catch (err) {
    logCallableError('touchDevice', err)
    // Swallow failures (do not break app usage)
  }
}

