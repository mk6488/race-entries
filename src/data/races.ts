import { Timestamp, addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, getDoc } from 'firebase/firestore'
import { db, authReady } from '../firebase'
import type { NewRace, Race } from '../models/firestore'
import { asBool, asDateFromTimestampLike, asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'

const racesCol = collection(db, 'races')

export function toRace(id: string, data: unknown, ctx?: { issues?: any; collection?: string; docId?: string }): Race {
  const baseCtx = ctx ? { ...ctx, collection: ctx.collection ?? 'races', docId: ctx.docId ?? id } : undefined
  const record = asRecord(data, false, baseCtx, undefined)
  return withId(id, {
    name: asString(record.name, '', false, baseCtx, 'name'),
    details: asString(record.details, '', false, baseCtx, 'details'),
    startDate: asDateFromTimestampLike(record.startDate, false, baseCtx, 'startDate') ?? new Date(0),
    endDate: asDateFromTimestampLike(record.endDate, false, baseCtx, 'endDate'),
    broeOpens: asDateFromTimestampLike(record.broeOpens, false, baseCtx, 'broeOpens') ?? new Date(0),
    broeCloses: asDateFromTimestampLike(record.broeCloses, false, baseCtx, 'broeCloses') ?? new Date(0),
    drawReleased: asBool(record.drawReleased, false, false, baseCtx, 'drawReleased'),
    archived: asBool(record.archived, false, false, baseCtx, 'archived'),
  })
}

function fromRace(r: NewRace) {
  return {
    name: r.name,
    details: r.details,
    startDate: Timestamp.fromDate(r.startDate),
    endDate: r.endDate ? Timestamp.fromDate(r.endDate) : null,
    broeOpens: Timestamp.fromDate(r.broeOpens),
    broeCloses: Timestamp.fromDate(r.broeCloses),
    drawReleased: r.drawReleased ?? false,
    archived: r.archived ?? false,
  }
}

export function subscribeRaces(cb: (races: Race[]) => void, onError?: (error: unknown) => void) {
  const q = query(racesCol, orderBy('startDate'))
  return onSnapshot(q, (snap) => {
    let skipped = 0
    const races = snap.docs.map((d) => {
      try {
        return toRace(d.id, d.data())
      } catch (err) {
        skipped += 1
        logWarn('races.toRace', err)
        return null
      }
    }).filter(Boolean) as Race[]
    if (skipped) {
      logWarn('races.subscribe', { skipped, total: snap.size })
    }
    cb(races)
  }, (err) => {
    logWarn('races.subscribe.error', err)
    onError?.(err)
  })
}

export async function getRaceById(id: string): Promise<Race | null> {
  const ref = doc(db, 'races', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return toRace(snap.id, snap.data())
}

export async function createRace(data: NewRace) {
  await authReady.catch(() => {})
  const ref = await addDoc(racesCol, fromRace(data))
  return ref.id
}

export async function updateRace(id: string, data: Partial<NewRace>) {
  await authReady.catch(() => {})
  await updateDoc(doc(db, 'races', id), fromRacePartial(data))
}

export async function deleteRace(id: string) {
  await authReady.catch(() => {})
  await deleteDoc(doc(db, 'races', id))
}

function fromRacePartial(r: Partial<NewRace>) {
  const out: Record<string, unknown> = {}
  if (r.name !== undefined) out.name = r.name
  if (r.details !== undefined) out.details = r.details
  if (r.startDate !== undefined) out.startDate = Timestamp.fromDate(r.startDate)
  if (r.endDate !== undefined) out.endDate = r.endDate ? Timestamp.fromDate(r.endDate) : null
  if (r.broeOpens !== undefined) out.broeOpens = Timestamp.fromDate(r.broeOpens)
  if (r.broeCloses !== undefined) out.broeCloses = Timestamp.fromDate(r.broeCloses)
  if (r.drawReleased !== undefined) out.drawReleased = r.drawReleased
  if (r.archived !== undefined) out.archived = r.archived
  return out
}


