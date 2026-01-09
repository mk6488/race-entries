import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { Entry, NewEntry } from '../models/firestore'
import { asBool, asNumber, asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'

const col = collection(db, 'entries')

const entryStatuses: Entry['status'][] = ['in_progress', 'ready', 'entered', 'withdrawn', 'rejected']
const entryResults: NonNullable<Entry['result']>[] = ['OK', 'DNS', 'DNF', 'DQ']

function toEntry(id: string, data: unknown): Entry {
  const record = asRecord(data)
  const statusValue = asString(record.status)
  const computedStatus = entryStatuses.includes(statusValue as Entry['status'])
    ? (statusValue as Entry['status'])
    : (asBool(record.withdrawn) ? 'withdrawn' : asBool(record.rejected) ? 'rejected' : 'ready')
  const raceTimesRaw = Array.isArray(record.raceTimes) ? record.raceTimes : []
  const raceTimes = raceTimesRaw.map((t) => {
    const rt = asRecord(t)
    return {
      round: asString(rt.round),
      timeMs: asNumber(rt.timeMs, 0) ?? 0,
    }
  })
  const resultValue = asString(record.result, 'OK')
  const result = entryResults.includes(resultValue as NonNullable<Entry['result']>)
    ? (resultValue as NonNullable<Entry['result']>)
    : 'OK'

  return {
    ...withId(id, {
      raceId: asString(record.raceId),
      day: asString(record.day),
      div: asString(record.div),
      event: asString(record.event),
      athleteNames: asString(record.athleteNames),
      boat: asString(record.boat),
      blades: asString(record.blades),
      notes: asString(record.notes),
      status: computedStatus,
      crewChanged: asBool(record.crewChanged),
      crewNumber: asNumber(record.crewNumber, null),
      raceTimes,
      result,
    }),
  }
}

function fromEntry(e: NewEntry) { return { ...e } }
function fromPartial(e: Partial<NewEntry>) { return { ...e } }

export function subscribeEntries(raceId: string, cb: (rows: Entry[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, where('raceId', '==', raceId), orderBy('event'))
  return onSnapshot(q, (snap) => {
    let skipped = 0
    const rows = snap.docs.map((d) => {
      try {
        return toEntry(d.id, d.data())
      } catch (err) {
        skipped += 1
        logWarn('entries.toEntry', err)
        return null
      }
    }).filter(Boolean) as Entry[]
    if (skipped) logWarn('entries.subscribe', { skipped, total: snap.size })
    cb(rows)
  }, (err) => {
    logWarn('entries.subscribe.error', err)
    onError?.(err)
  })
}

export async function createEntry(data: NewEntry) { const ref = await addDoc(col, fromEntry(data)); return ref.id }
export async function updateEntry(id: string, data: Partial<NewEntry>) { await updateDoc(doc(db, 'entries', id), fromPartial(data)) }
export async function deleteEntry(id: string) { await deleteDoc(doc(db, 'entries', id)) }


