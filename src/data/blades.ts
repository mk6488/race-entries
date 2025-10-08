import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db, authReady } from '../firebase'

export type Blade = { id: string; name: string; active?: boolean; amount?: number }

const col = collection(db, 'blades')

export function subscribeBlades(cb: (rows: Blade[]) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))))
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


