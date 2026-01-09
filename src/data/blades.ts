import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db, authReady } from '../firebase'
import type { Blade } from '../models/firestore'
import { asBool, asNumber, asRecord, asString, withId } from './firestoreMapping'
export type { Blade }

const col = collection(db, 'blades')

export function subscribeBlades(cb: (rows: Blade[]) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toBlade(d.id, d.data()))))
}

function toBlade(id: string, data: unknown): Blade {
  const record = asRecord(data)
  const lengthCode = asString(record.lengthCode)
  const validLengthCodes: Blade['lengthCode'][] = ['1', '2', '3', '4', '5', 'NA']
  const amount = asNumber(record.amount, undefined)
  return withId(id, {
    name: asString(record.name),
    active: asBool(record.active, undefined),
    amount: amount === null ? undefined : amount,
    lengthCode: (validLengthCodes.includes(lengthCode as Blade['lengthCode']) ? lengthCode : undefined) as Blade['lengthCode'],
    bladeLength: asNumber(record.bladeLength, null),
    inboard: asNumber(record.inboard, null),
    span: asNumber(record.span, null),
  })
}

export async function updateBladeAmount(id: string, amount: number) {
  await authReady.catch(() => {})
  const ref = doc(db, 'blades', id)
  await updateDoc(ref, { amount })
}

export async function createBlade(data: Omit<Blade, 'id'>) {
  await authReady.catch(() => {})
  const ref = await addDoc(col, data)
  return ref.id
}

export async function updateBlade(id: string, data: Partial<Omit<Blade, 'id'>>) {
  await authReady.catch(() => {})
  await updateDoc(doc(db, 'blades', id), data as any)
}

export async function deleteBlade(id: string) {
  await authReady.catch(() => {})
  await deleteDoc(doc(db, 'blades', id))
}


