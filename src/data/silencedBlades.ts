import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export type BladeSilence = {
  id: string
  raceId: string
  day: string
  group: string
  blade: string
}

const col = collection(db, 'silencedBladeClashes')

function toModel(id: string, data: any): BladeSilence {
  return {
    id,
    raceId: String(data.raceId || ''),
    day: String(data.day || ''),
    group: String(data.group || ''),
    blade: String(data.blade || ''),
  }
}

export function subscribeBladeSilences(raceId: string, cb: (rows: BladeSilence[]) => void) {
  const q = query(col, where('raceId', '==', raceId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toModel(d.id, d.data()))))
}

export async function createBladeSilence(data: Omit<BladeSilence, 'id'>) {
  await addDoc(col, data)
}

export async function deleteBladeSilenceByBlade(raceId: string, day: string, group: string, blade: string) {
  const q = query(col, where('raceId','==',raceId), where('day','==',day), where('group','==',group), where('blade','==',blade))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'silencedBladeClashes', d.id))))
}
