import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { db } from '../firebase'
import type { Entry, NewEntry } from '../models/firestore'
import { asBool, asNumber, asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
import { subscribeCached } from './subscriptionCache'
import { trace } from '../utils/trace'
import { wrapError } from '../utils/wrapError'
import { stripUndefined } from '../utils/stripUndefined'

const col = collection(db, 'entries')

const entryStatuses: Entry['status'][] = ['in_progress', 'ready', 'entered', 'withdrawn', 'rejected']
const entryResults: NonNullable<Entry['result']>[] = ['OK', 'DNS', 'DNF', 'DQ']

export function toEntry(id: string, data: unknown, ctx?: { issues?: any; collection?: string; docId?: string }): Entry {
  const baseCtx = ctx ? { ...ctx, collection: ctx.collection ?? 'entries', docId: ctx.docId ?? id } : undefined
  const record = asRecord(data, false, baseCtx, undefined)
  const statusValue = asString(record.status)
  const computedStatus = entryStatuses.includes(statusValue as Entry['status'])
    ? (statusValue as Entry['status'])
    : (asBool(record.withdrawn, false, false, baseCtx, 'withdrawn') ? 'withdrawn' : asBool(record.rejected, false, false, baseCtx, 'rejected') ? 'rejected' : 'ready')
  const raceTimesRaw = Array.isArray(record.raceTimes) ? record.raceTimes : []
  const raceTimes = raceTimesRaw.map((t) => {
    const rt = asRecord(t)
    return {
      round: asString(rt.round, '', false, baseCtx, 'raceTimes.round'),
      timeMs: asNumber(rt.timeMs, 0, false, baseCtx, 'raceTimes.timeMs') ?? 0,
    }
  })
  const resultValue = asString(record.result, 'OK', false, baseCtx, 'result')
  const result = entryResults.includes(resultValue as NonNullable<Entry['result']>)
    ? (resultValue as NonNullable<Entry['result']>)
    : 'OK'

  return {
    ...withId(id, {
      raceId: asString(record.raceId, '', false, baseCtx, 'raceId'),
      day: asString(record.day, '', false, baseCtx, 'day'),
      div: asString(record.div, '', false, baseCtx, 'div'),
      event: asString(record.event, '', false, baseCtx, 'event'),
      athleteNames: asString(record.athleteNames, '', false, baseCtx, 'athleteNames'),
      boat: asString(record.boat, '', false, baseCtx, 'boat'),
      blades: asString(record.blades, '', false, baseCtx, 'blades'),
      notes: asString(record.notes, '', false, baseCtx, 'notes'),
      status: computedStatus,
      crewChanged: asBool(record.crewChanged, false, false, baseCtx, 'crewChanged'),
      crewNumber: asNumber(record.crewNumber, null, false, baseCtx, 'crewNumber'),
      raceTimes,
      result,
    }),
  }
}

function fromEntry(e: NewEntry) { return { ...e } }
function fromPartial(e: Partial<NewEntry>) { return { ...e } }

export function subscribeEntries(raceId: string, cb: (rows: Entry[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, where('raceId', '==', raceId), orderBy('event'))
  const key = `entries:raceId=${raceId}`
  trace({ type: 'sub:start', scope: 'entries', meta: { raceId, key } })
  return subscribeCached(
    key,
    (emit, emitError) =>
      onSnapshot(
        q,
        (snap) => {
          let skipped = 0
          const rows = snap.docs
            .map((d) => {
              try {
                return toEntry(d.id, d.data())
              } catch (err) {
                skipped += 1
                logWarn('entries.toEntry', err)
                trace({ type: 'sub:skipDocs', scope: 'entries', meta: { count: 1, key } })
                return null
              }
            })
            .filter(Boolean) as Entry[]
          if (skipped) logWarn('entries.subscribe', { skipped, total: snap.size })
          if (skipped) trace({ type: 'sub:skipDocs', scope: 'entries', meta: { count: skipped, key } })
          emit(rows)
        },
        (err) => {
          logWarn('entries.subscribe.error', err)
          trace({ type: 'error', scope: 'entries', meta: { key } })
          emitError(wrapError('entries.subscribe', err, { key }))
        },
      ),
    cb,
    (err) => {
      onError?.(err)
      trace({ type: 'sub:stop', scope: 'entries', meta: { raceId, key, reason: 'error' } })
    },
  )
}

export async function createEntry(data: NewEntry) {
  trace({ type: 'write:create', scope: 'entries', meta: { raceId: data.raceId } })
  const ref = await addDoc(col, fromEntry(data))
  return ref.id
}

export async function updateEntry(id: string, data: Partial<NewEntry>) {
  trace({ type: 'write:update', scope: 'entries', meta: { id } })
  const payload: UpdateData<NewEntry> = stripUndefined(fromPartial(data))
  await updateDoc(doc(db, 'entries', id), payload)
}

export async function deleteEntry(id: string) {
  trace({ type: 'write:delete', scope: 'entries', meta: { id } })
  await deleteDoc(doc(db, 'entries', id))
}


