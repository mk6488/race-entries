import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { DivisionGroup } from '../models/firestore'
import { asRecord, asString, asStringArray, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
import { subscribeCached } from './subscriptionCache'
import { trace } from '../utils/trace'
import { wrapError } from '../utils/wrapError'
export type { DivisionGroup }

const col = collection(db, 'divisionGroups')

export function toModel(id: string, data: unknown, ctx?: { issues?: any; collection?: string; docId?: string }): DivisionGroup {
  const baseCtx = ctx ? { ...ctx, collection: ctx.collection ?? 'divisionGroups', docId: ctx.docId ?? id } : undefined
  const record = asRecord(data, false, baseCtx, undefined)
  return withId(id, {
    raceId: asString(record.raceId, '', false, baseCtx, 'raceId'),
    day: asString(record.day, '', false, baseCtx, 'day'),
    group: asString(record.group, '', false, baseCtx, 'group'),
    divisions: asStringArray(record.divisions, [], false, baseCtx, 'divisions'),
  })
}

export function subscribeDivisionGroups(raceId: string, cb: (rows: DivisionGroup[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, where('raceId', '==', raceId))
  const key = `divisionGroups:raceId=${raceId}`
  trace({ type: 'sub:start', scope: 'divisionGroups', meta: { raceId, key } })
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
                return toModel(d.id, d.data())
              } catch (err) {
                skipped += 1
                logWarn('divisionGroups.toModel', err)
                trace({ type: 'sub:skipDocs', scope: 'divisionGroups', meta: { count: 1, raceId, key } })
                return null
              }
            })
            .filter(Boolean) as DivisionGroup[]
          if (skipped) logWarn('divisionGroups.subscribe', { skipped, total: snap.size })
          if (skipped) trace({ type: 'sub:skipDocs', scope: 'divisionGroups', meta: { count: skipped, raceId, key } })
          emit(rows)
        },
        (err) => {
          logWarn('divisionGroups.subscribe.error', err)
          trace({ type: 'error', scope: 'divisionGroups', meta: { raceId, key } })
          emitError(wrapError('divisionGroups.subscribe', err, { raceId, key }))
        },
      ),
    cb,
    (err) => {
      onError?.(err)
      trace({ type: 'sub:stop', scope: 'divisionGroups', meta: { raceId, key, reason: 'error' } })
    },
  )
}

export async function createDivisionGroup(data: Omit<DivisionGroup, 'id'>) {
  trace({ type: 'write:create', scope: 'divisionGroups', meta: { raceId: data.raceId } })
  await addDoc(col, data)
}

export async function updateDivisionGroup(id: string, data: Partial<DivisionGroup>) {
  trace({ type: 'write:update', scope: 'divisionGroups', meta: { id } })
  await updateDoc(doc(db, 'divisionGroups', id), data as any)
}

export async function deleteDivisionGroup(id: string) {
  trace({ type: 'write:delete', scope: 'divisionGroups', meta: { id } })
  await deleteDoc(doc(db, 'divisionGroups', id))
}
