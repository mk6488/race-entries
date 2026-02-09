import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { db, authReady } from '../firebase'
import type { Blade } from '../models/firestore'
import { asBool, asNumber, asRecord, asString, withId } from './firestoreMapping'
import { logWarn } from '../utils/log'
import { stripUndefined } from '../utils/stripUndefined'
export type { Blade }

const col = collection(db, 'blades')

export function subscribeBlades(cb: (rows: Blade[]) => void, onError?: (error: unknown) => void) {
  const q = query(col, orderBy('name'))
  return onSnapshot(q, (snap) => {
    let skipped = 0
    const rows = snap.docs.map((d) => {
      try {
        return toBlade(d.id, d.data())
      } catch (err) {
        skipped += 1
        logWarn('blades.toBlade', err)
        return null
      }
    }).filter(Boolean) as Blade[]
    if (skipped) logWarn('blades.subscribe', { skipped, total: snap.size })
    cb(rows)
  }, (err) => {
    logWarn('blades.subscribe.error', err)
    onError?.(err)
  })
}

export function toBlade(id: string, data: unknown, ctx?: { issues?: any; collection?: string; docId?: string }): Blade {
  const baseCtx = ctx ? { ...ctx, collection: ctx.collection ?? 'blades', docId: ctx.docId ?? id } : undefined
  const record = asRecord(data, false, baseCtx)
  const lengthCode = asString(record.lengthCode)
  const validLengthCodes: Blade['lengthCode'][] = ['1', '2', '3', '4', '5', 'NA']
  const amount = asNumber(record.amount, undefined)
  return withId(id, {
    name: asString(record.name, '', false, baseCtx, 'name'),
    active: asBool(record.active, undefined, false, baseCtx, 'active'),
    amount: amount === null ? undefined : amount,
    lengthCode: (validLengthCodes.includes(lengthCode as Blade['lengthCode']) ? lengthCode : undefined) as Blade['lengthCode'],
    bladeLength: asNumber(record.bladeLength, null, false, baseCtx, 'bladeLength'),
    inboard: asNumber(record.inboard, null, false, baseCtx, 'inboard'),
    span: asNumber(record.span, null, false, baseCtx, 'span'),
  })
}

export async function updateBladeAmount(id: string, amount: number) {
  await authReady.catch(() => {})
  const ref = doc(db, 'blades', id)
  const payload: UpdateData<Omit<Blade, 'id'>> = stripUndefined({ amount })
  await updateDoc(ref, payload)
}

export async function createBlade(data: Omit<Blade, 'id'>) {
  await authReady.catch(() => {})
  const ref = await addDoc(col, data)
  return ref.id
}

export async function updateBlade(id: string, data: Partial<Omit<Blade, 'id'>>) {
  await authReady.catch(() => {})
  const payload: UpdateData<Omit<Blade, 'id'>> = stripUndefined(data)
  await updateDoc(doc(db, 'blades', id), payload)
}

export async function deleteBlade(id: string) {
  await authReady.catch(() => {})
  await deleteDoc(doc(db, 'blades', id))
}


