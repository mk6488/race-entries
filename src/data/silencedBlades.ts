import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { SilencedBladeClash } from '../models/firestore'
import { asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
export type { SilencedBladeClash as BladeSilence }

const col = collection(db, 'silencedBladeClashes')

function toModel(id: string, data: unknown): SilencedBladeClash {
  const record = asRecord(data)
  return withId(id, {
    raceId: asString(record.raceId),
    day: asString(record.day),
    group: asString(record.group),
    blade: asString(record.blade),
  })
}

export function subscribeBladeSilences(raceId: string, cb: (rows: SilencedBladeClash[]) => void) {
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
  })
}

export async function createBladeSilence(data: Omit<SilencedBladeClash, 'id'>) {
  await addDoc(col, data)
}

export async function deleteBladeSilenceByBlade(raceId: string, day: string, group: string, blade: string) {
  const q = query(col, where('raceId','==',raceId), where('day','==',day), where('group','==',group), where('blade','==',blade))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'silencedBladeClashes', d.id))))
}
