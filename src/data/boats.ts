import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db, authReady } from '../firebase'
import type { Boat } from '../models/firestore'
import { asBool, asNumber, asRecord, asString, withId } from './firestoreMapping'
export type { Boat }

const col = collection(db, 'boats')

export function subscribeBoats(cb: (rows: Boat[]) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toBoat(d.id, d.data()))))
}

function toBoat(id: string, data: unknown): Boat {
  const record = asRecord(data)
  const weight = asNumber(record.weight, undefined)
  return withId(id, {
    name: asString(record.name),
    type: asString(record.type),
    active: asBool(record.active, undefined),
    weight: weight === null ? undefined : weight,
  })
}

export async function createBoat(data: Omit<Boat, 'id'>) {
  await authReady.catch(() => {})
  const ref = await addDoc(col, data)
  return ref.id
}

export async function updateBoat(id: string, data: Partial<Omit<Boat, 'id'>>) {
  await authReady.catch(() => {})
  await updateDoc(doc(db, 'boats', id), data as any)
}

export async function deleteBoat(id: string) {
  await authReady.catch(() => {})
  await deleteDoc(doc(db, 'boats', id))
}


