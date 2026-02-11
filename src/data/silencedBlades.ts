import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db, ensureAnonAuth } from '../firebase'
import type { SilencedBladeClash } from '../models/firestore'
import { asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
import { buildCreateAudit } from './audit'
import type { CoachContext } from '../coach/coachContext'
export type { SilencedBladeClash as BladeSilence }

const col = collection(db, 'silencedBladeClashes')

export function toModel(id: string, data: unknown, ctx?: { issues?: any; collection?: string; docId?: string }): SilencedBladeClash {
  const baseCtx = ctx ? { ...ctx, collection: ctx.collection ?? 'silencedBladeClashes', docId: ctx.docId ?? id } : undefined
  const record = asRecord(data, false, baseCtx)
  return withId(id, {
    raceId: asString(record.raceId, '', false, baseCtx, 'raceId'),
    day: asString(record.day, '', false, baseCtx, 'day'),
    group: asString(record.group, '', false, baseCtx, 'group'),
    blade: asString(record.blade, '', false, baseCtx, 'blade'),
  })
}

export function subscribeBladeSilences(raceId: string, cb: (rows: SilencedBladeClash[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, where('raceId', '==', raceId))
  return onSnapshot(q, (snap) => {
    let skipped = 0
    const rows = snap.docs.map((d) => {
      try {
        return toModel(d.id, d.data())
      } catch (err) {
        skipped += 1
        logWarn('silencedBladeClashes.toModel', err)
        return null
      }
    }).filter(Boolean) as SilencedBladeClash[]
    if (skipped) logWarn('silencedBladeClashes.subscribe', { skipped, total: snap.size })
    cb(rows)
  }, (err) => {
    logWarn('silencedBladeClashes.subscribe.error', err)
    onError?.(err)
  })
}

export async function createBladeSilence(data: Omit<SilencedBladeClash, 'id'>, coach?: Partial<CoachContext>) {
  await ensureAnonAuth()
  await addDoc(col, { ...data, ...buildCreateAudit(coach) })
}

export async function deleteBladeSilenceByBlade(raceId: string, day: string, group: string, blade: string) {
  await ensureAnonAuth()
  const q = query(col, where('raceId','==',raceId), where('day','==',day), where('group','==',group), where('blade','==',blade))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'silencedBladeClashes', d.id))))
}
