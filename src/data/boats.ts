import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db, authReady } from '../firebase'

export type Boat = { id: string; name: string; type: string; active?: boolean; weight?: number }

const col = collection(db, 'boats')

export function subscribeBoats(cb: (rows: Boat[]) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))))
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


