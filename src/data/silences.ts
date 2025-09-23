import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

export type Silence = {
  id: string
  raceId: string
  day: string
  group: string
  boat: string
}

const col = collection(db, 'silencedClashes')

function toModel(id: string, data: any): Silence {
  return {
    id,
    raceId: String(data.raceId || ''),
    day: String(data.day || ''),
    group: String(data.group || ''),
    boat: String(data.boat || ''),
  }
}

export function subscribeSilences(raceId: string, cb: (rows: Silence[]) => void) {
  const q = query(col, where('raceId', '==', raceId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toModel(d.id, d.data()))))
}

export async function createSilence(data: Omit<Silence, 'id'>) {
  await addDoc(col, data)
}

export async function deleteSilenceByBoat(raceId: string, day: string, group: string, boat: string) {
  const q = query(col, where('raceId','==',raceId), where('day','==',day), where('group','==',group), where('boat','==',boat))
  const unsub = onSnapshot(q, async (snap) => {
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'silencedClashes', d.id))
    }
  })
  setTimeout(() => unsub(), 0)
}
