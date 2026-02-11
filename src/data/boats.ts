import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { db, ensureAnonAuth } from '../firebase'
import type { Boat } from '../models/firestore'
import { asBool, asNumber, asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
import { stripUndefined } from '../utils/stripUndefined'
import { buildCreateAudit, buildUpdateAudit } from './audit'
import type { CoachContext } from '../coach/coachContext'
export type { Boat }

const col = collection(db, 'boats')

export function subscribeBoats(cb: (rows: Boat[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => {
    let skipped = 0
    const rows = snap.docs.map((d) => {
      try {
        return toBoat(d.id, d.data())
      } catch (err) {
        skipped += 1
        logWarn('boats.toBoat', err)
        return null
      }
    }).filter(Boolean) as Boat[]
    if (skipped) logWarn('boats.subscribe', { skipped, total: snap.size })
    cb(rows)
  }, (err) => {
    logWarn('boats.subscribe.error', err)
    onError?.(err)
  })
}

export function toBoat(id: string, data: unknown, ctx?: { issues?: any; collection?: string; docId?: string }): Boat {
  const baseCtx = ctx ? { ...ctx, collection: ctx.collection ?? 'boats', docId: ctx.docId ?? id } : undefined
  const record = asRecord(data, false, baseCtx)
  const weight = asNumber(record.weight, undefined)
  return withId(id, {
    name: asString(record.name, '', false, baseCtx, 'name'),
    type: asString(record.type, '', false, baseCtx, 'type'),
    active: asBool(record.active, undefined, false, baseCtx, 'active'),
    weight: weight === null ? undefined : weight,
  })
}

export async function createBoat(data: Omit<Boat, 'id'>, coach?: Partial<CoachContext>) {
  await ensureAnonAuth()
  const ref = await addDoc(col, { ...data, ...buildCreateAudit(coach) })
  return ref.id
}

export async function updateBoat(id: string, data: Partial<Omit<Boat, 'id'>>, coach?: Partial<CoachContext>) {
  await ensureAnonAuth()
  const payload: UpdateData<Omit<Boat, 'id'>> = stripUndefined({ ...data, ...buildUpdateAudit(coach) })
  await updateDoc(doc(db, 'boats', id), payload)
}

export async function deleteBoat(id: string) {
  await ensureAnonAuth()
  await deleteDoc(doc(db, 'boats', id))
}


