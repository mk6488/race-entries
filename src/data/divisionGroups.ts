import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

export type DivisionGroup = {
  id: string
  raceId: string
  day: string
  group: string
  divisions: string[]
}

const col = collection(db, 'divisionGroups')

function toModel(id: string, data: any): DivisionGroup {
  return {
    id,
    raceId: String(data.raceId || ''),
    day: String(data.day || ''),
    group: String(data.group || ''),
    divisions: Array.isArray(data.divisions) ? data.divisions.map(String) : [],
  }
}

export function subscribeDivisionGroups(raceId: string, cb: (rows: DivisionGroup[]) => void) {
  const q = query(col, where('raceId', '==', raceId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toModel(d.id, d.data()))))
}

export async function createDivisionGroup(data: Omit<DivisionGroup, 'id'>) {
  await addDoc(col, data)
}

export async function updateDivisionGroup(id: string, data: Partial<DivisionGroup>) {
  await updateDoc(doc(db, 'divisionGroups', id), data as any)
}

export async function deleteDivisionGroup(id: string) {
  await deleteDoc(doc(db, 'divisionGroups', id))
}
