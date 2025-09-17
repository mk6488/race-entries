import { Timestamp, addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { NewRace, Race } from '../models/race'

const racesCol = collection(db, 'races')

function toRace(id: string, data: any): Race {
  return {
    id,
    name: data.name as string,
    details: data.details as string,
    startDate: (data.startDate as Timestamp).toDate(),
    endDate: data.endDate ? (data.endDate as Timestamp).toDate() : null,
    broeOpens: (data.broeOpens as Timestamp).toDate(),
    broeCloses: (data.broeCloses as Timestamp).toDate(),
  }
}

function fromRace(r: NewRace) {
  return {
    name: r.name,
    details: r.details,
    startDate: Timestamp.fromDate(r.startDate),
    endDate: r.endDate ? Timestamp.fromDate(r.endDate) : null,
    broeOpens: Timestamp.fromDate(r.broeOpens),
    broeCloses: Timestamp.fromDate(r.broeCloses),
  }
}

export function subscribeRaces(cb: (races: Race[]) => void) {
  const q = query(racesCol, orderBy('startDate'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toRace(d.id, d.data())))
  })
}

export async function createRace(data: NewRace) {
  const ref = await addDoc(racesCol, fromRace(data))
  return ref.id
}

export async function updateRace(id: string, data: Partial<NewRace>) {
  await updateDoc(doc(db, 'races', id), fromRacePartial(data))
}

export async function deleteRace(id: string) {
  await deleteDoc(doc(db, 'races', id))
}

function fromRacePartial(r: Partial<NewRace>) {
  const out: any = {}
  if (r.name !== undefined) out.name = r.name
  if (r.details !== undefined) out.details = r.details
  if (r.startDate !== undefined) out.startDate = Timestamp.fromDate(r.startDate)
  if (r.endDate !== undefined) out.endDate = r.endDate ? Timestamp.fromDate(r.endDate) : null
  if (r.broeOpens !== undefined) out.broeOpens = Timestamp.fromDate(r.broeOpens)
  if (r.broeCloses !== undefined) out.broeCloses = Timestamp.fromDate(r.broeCloses)
  return out
}


