import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { ensureAuth } from '../firebase'

export type Blade = { id: string; name: string; active?: boolean; amount?: number }

const col = collection(db, 'blades')

export function subscribeBlades(cb: (rows: Blade[]) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))))
}

export async function updateBladeAmount(id: string, amount: number) {
  await ensureAuth()
  const ref = doc(db, 'blades', id)
  await updateDoc(ref, { amount })
}


