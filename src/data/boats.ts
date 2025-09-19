import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

export type Boat = { id: string; name: string; type: string; active?: boolean }

const col = collection(db, 'boats')

export function subscribeBoats(cb: (rows: Boat[]) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))))
}


