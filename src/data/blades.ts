import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

export type Blade = { id: string; name: string; active?: boolean }

const col = collection(db, 'blades')

export function subscribeBlades(cb: (rows: Blade[]) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))))
}


