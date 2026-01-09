import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { DivisionGroup } from '../models/firestore'
import { asRecord, asString, asStringArray, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
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

export function subscribeDivisionGroups(raceId: string, cb: (rows: DivisionGroup[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, where('raceId', '==', raceId))
  return onSnapshot(q, (snap) => {
    let skipped = 0
    const rows = snap.docs.map((d) => {
      try {
        return toModel(d.id, d.data())
      } catch (err) {
        skipped += 1
        logWarn('divisionGroups.toModel', err)
        return null
      }
    }).filter(Boolean) as DivisionGroup[]
    if (skipped) logWarn('divisionGroups.subscribe', { skipped, total: snap.size })
    cb(rows)
  }, (err) => {
    logWarn('divisionGroups.subscribe.error', err)
    onError?.(err)
  })
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
