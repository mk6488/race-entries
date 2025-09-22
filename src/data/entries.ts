import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Entry, NewEntry } from '../models/entry'

const col = collection(db, 'entries')

function toEntry(id: string, data: any): Entry {
  return {
    id,
    raceId: data.raceId || '',
    day: data.day || '',
    div: data.div || '',
    event: data.event || '',
    athleteNames: data.athleteNames || '',
    boat: data.boat || '',
    blades: data.blades || '',
    notes: data.notes || '',
    status: (data.status as Entry['status']) || (data.withdrawn ? 'withdrawn' : data.rejected ? 'rejected' : 'ready'),
    crewChanged: !!data.crewChanged,
  }
}

function fromEntry(e: NewEntry) { return { ...e } }
function fromPartial(e: Partial<NewEntry>) { return { ...e } }

export function subscribeEntries(raceId: string, cb: (rows: Entry[]) => void) {
  const q = query(col, where('raceId', '==', raceId), orderBy('event'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toEntry(d.id, d.data()))))
}

export async function createEntry(data: NewEntry) { const ref = await addDoc(col, fromEntry(data)); return ref.id }
export async function updateEntry(id: string, data: Partial<NewEntry>) { await updateDoc(doc(db, 'entries', id), fromPartial(data)) }
export async function deleteEntry(id: string) { await deleteDoc(doc(db, 'entries', id)) }


