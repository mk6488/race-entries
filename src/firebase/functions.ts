import { getFunctions, httpsCallable } from 'firebase/functions'
import type { HttpsCallable } from 'firebase/functions'
import { app } from '../firebase'

const region = import.meta.env.VITE_FUNCTIONS_REGION ?? 'europe-west2'
export const functionsRegion = region
export const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'unknown'

// Explicit region avoids CORS issues from wrong endpoint.
export const functions = getFunctions(app, region)

if (import.meta.env.DEV) {
  console.info(`[functions] region=${region} projectId=${firebaseProjectId}`)
}

export type CoachIdentityResult = { coachId: string; coachName: string }

export type CreateCoachProfileInput = {
  firstName: string
  lastName: string
  pin: string
  deviceLabel?: string
}

export type LinkDeviceToCoachInput = {
  firstName: string
  lastName: string
  pin: string
  deviceLabel?: string
  coachId?: string
}

export type TouchDeviceInput = { deviceLabel?: string }

export const createCoachProfile: HttpsCallable<CreateCoachProfileInput, CoachIdentityResult> = httpsCallable(
  functions,
  'createCoachProfile',
)

export const linkDeviceToCoach: HttpsCallable<LinkDeviceToCoachInput, CoachIdentityResult> = httpsCallable(
  functions,
  'linkDeviceToCoach',
)

export const touchDevice: HttpsCallable<TouchDeviceInput, unknown> = httpsCallable(functions, 'touchDevice')

/*
DEV-only snippet (no UI needed):

  import { httpsCallable } from 'firebase/functions'
  import { functions } from './functions'

  const healthcheck = httpsCallable(functions, 'healthcheck')
  const res = await healthcheck({})
  console.info('healthcheck', res.data)
*/

export function logCallableError(scope: string, err: unknown) {
  if (!import.meta.env.DEV) return
  const anyErr = err as { code?: unknown; message?: unknown; details?: unknown }
  console.warn(`[functions] ${scope} failed`, {
    code: anyErr?.code,
    message: anyErr?.message,
    details: anyErr?.details,
  })
}

