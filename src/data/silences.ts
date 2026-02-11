import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { SilencedClash } from '../models/firestore'
import { asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
import { buildCreateAudit } from './audit'
import type { CoachContext } from '../coach/coachContext'
export type { SilencedClash as Silence }

const col = collection(db, 'silencedClashes')

export function toModel(id: string, data: unknown, ctx?: { issues?: any; collection?: string; docId?: string }): SilencedClash {
  const baseCtx = ctx ? { ...ctx, collection: ctx.collection ?? 'silencedClashes', docId: ctx.docId ?? id } : undefined
  const record = asRecord(data, false, baseCtx)
  return withId(id, {
    raceId: asString(record.raceId, '', false, baseCtx, 'raceId'),
    day: asString(record.day, '', false, baseCtx, 'day'),
    group: asString(record.group, '', false, baseCtx, 'group'),
    boat: asString(record.boat, '', false, baseCtx, 'boat'),
  })
}

export function subscribeSilences(raceId: string, cb: (rows: SilencedClash[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, where('raceId', '==', raceId))
  return onSnapshot(q, (snap) => {
    let skipped = 0
    const rows = snap.docs.map((d) => {
      try {
        return toModel(d.id, d.data())
      } catch (err) {
        skipped += 1
        logWarn('silences.toModel', err)
        return null
      }
    }).filter(Boolean) as SilencedClash[]
    if (skipped) logWarn('silences.subscribe', { skipped, total: snap.size })
    cb(rows)
  }, (err) => {
    logWarn('silences.subscribe.error', err)
    onError?.(err)
  })
}

export async function createSilence(data: Omit<SilencedClash, 'id'>, coach?: Partial<CoachContext>) {
  await addDoc(col, { ...data, ...buildCreateAudit(coach) })
}

export async function deleteSilenceByBoat(raceId: string, day: string, group: string, boat: string) {
  const q = query(col, where('raceId','==',raceId), where('day','==',day), where('group','==',group), where('boat','==',boat))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'silencedClashes', d.id))))
}
