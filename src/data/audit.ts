import { serverTimestamp } from 'firebase/firestore'
import type { FieldValue } from 'firebase/firestore'
import type { CoachContext } from '../coach/coachContext'
import { auth } from '../firebase'
import { getCachedCoachContext } from '../coach/coachContext'

export type AuditFields = {
  createdAt?: FieldValue
  createdByCoachId?: string | null
  createdByCoachName?: string | null
  createdByUid?: string | null
  updatedAt?: FieldValue
  updatedByCoachId?: string | null
  updatedByCoachName?: string | null
  updatedByUid?: string | null
}

function normaliseCoach(ctx?: Partial<CoachContext>): { uid: string | null; coachId: string | null; coachName: string | null } {
  const uid = ctx?.uid ?? auth.currentUser?.uid ?? null
  const cached = getCachedCoachContext()
  const coachId = ctx?.coachId ?? cached.coachId ?? null
  const coachName = ctx?.coachName ?? cached.coachName ?? null
  return { uid, coachId, coachName }
}

export function buildCreateAudit(ctx?: Partial<CoachContext>): AuditFields {
  const meta = normaliseCoach(ctx)
  const coachName = meta.coachName ?? 'Unlinked Coach'
  return {
    createdAt: serverTimestamp(),
    createdByCoachId: meta.coachId ?? null,
    createdByCoachName: coachName,
    createdByUid: meta.uid ?? null,
    updatedAt: serverTimestamp(),
    updatedByCoachId: meta.coachId ?? null,
    updatedByCoachName: coachName,
    updatedByUid: meta.uid ?? null,
  }
}

export function buildUpdateAudit(ctx?: Partial<CoachContext>): AuditFields {
  const meta = normaliseCoach(ctx)
  const coachName = meta.coachName ?? 'Unlinked Coach'
  return {
    updatedAt: serverTimestamp(),
    updatedByCoachId: meta.coachId ?? null,
    updatedByCoachName: coachName,
    updatedByUid: meta.uid ?? null,
  }
}

