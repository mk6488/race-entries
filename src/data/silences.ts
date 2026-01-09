import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { SilencedClash } from '../models/firestore'
import { asRecord, asString, withId } from './firestoreMapping'
export type { SilencedClash as Silence }

const col = collection(db, 'silencedClashes')

function toModel(id: string, data: unknown): SilencedClash {
  const record = asRecord(data)
  return withId(id, {
    raceId: asString(record.raceId),
    day: asString(record.day),
    group: asString(record.group),
    boat: asString(record.boat),
  })
}

export function subscribeSilences(raceId: string, cb: (rows: SilencedClash[]) => void) {
  const q = query(col, where('raceId', '==', raceId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toModel(d.id, d.data()))))
}

export async function createSilence(data: Omit<SilencedClash, 'id'>) {
  await addDoc(col, data)
}

export async function deleteSilenceByBoat(raceId: string, day: string, group: string, boat: string) {
  const q = query(col, where('raceId','==',raceId), where('day','==',day), where('group','==',group), where('boat','==',boat))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'silencedClashes', d.id))))
}
