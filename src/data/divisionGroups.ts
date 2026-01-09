import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { DivisionGroup } from '../models/firestore'
import { asRecord, asString, asStringArray, withId } from './firestoreMapping'
export type { DivisionGroup }

const col = collection(db, 'divisionGroups')

function toModel(id: string, data: unknown): DivisionGroup {
  const record = asRecord(data)
  return withId(id, {
    raceId: asString(record.raceId),
    day: asString(record.day),
    group: asString(record.group),
    divisions: asStringArray(record.divisions),
  })
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
