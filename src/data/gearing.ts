import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import type { UpdateData } from 'firebase/firestore'
import { db, ensureAnonAuth } from '../firebase'
import type { Gearing, GearingMatrix } from '../models/firestore'
import { asRecord, asString } from './firestoreMapping'
import { logWarn } from '../utils/log'
import { stripUndefined } from '../utils/stripUndefined'
import { buildCreateAudit, buildUpdateAudit } from './audit'
import type { CoachContext } from '../coach/coachContext'
export type { GearingMatrix }

const col = collection(db, 'gearing')

export function subscribeGearing(raceId: string, cb: (values: GearingMatrix) => void) {
  const ref = doc(col, raceId)
  return onSnapshot(ref, (snap) => {
    try {
      const data = snap.exists() ? snap.data() : {}
      cb(toGearingMatrix(asRecord(data).values ?? {}))
    } catch (err) {
      logWarn('gearing.toGearingMatrix', err)
      cb({})
    }
  })
}

export async function initGearingIfMissing(raceId: string, initial: GearingMatrix, coach?: Partial<CoachContext>) {
  await ensureAnonAuth()
  const ref = doc(col, raceId)
  await setDoc(ref, { values: initial, ...buildCreateAudit(coach) }, { merge: true })
}

export async function updateGearingCell(raceId: string, age: string, boatType: string, code: string, coach?: Partial<CoachContext>) {
  await ensureAnonAuth()
  const ref = doc(col, raceId)
  const path = `values.${age}.${boatType}`
  const payload: UpdateData<Gearing> = stripUndefined({ [path]: code, ...buildUpdateAudit(coach) })
  await updateDoc(ref, payload)
}

// Global (non-race) gearing defaults stored under doc id 'default'
export function subscribeGlobalGearing(cb: (values: GearingMatrix) => void) {
  const ref = doc(col, 'default')
  return onSnapshot(ref, (snap) => {
    try {
      const data = snap.exists() ? snap.data() : {}
      cb(toGearingMatrix(asRecord(data).values ?? {}))
    } catch (err) {
      logWarn('gearing.global.toGearingMatrix', err)
      cb({})
    }
  })
}

export async function initGlobalGearingIfMissing(initial: GearingMatrix, coach?: Partial<CoachContext>) {
  await ensureAnonAuth()
  const ref = doc(col, 'default')
  const snap = await getDoc(ref)
  const existing = snap.exists() ? (snap.data() as any) : null
  if (!existing || !existing.values) {
    await setDoc(ref, { values: initial, ...buildCreateAudit(coach) }, { merge: false })
  }
}

export async function updateGlobalGearingCell(age: string, boatType: string, code: string, coach?: Partial<CoachContext>) {
  await ensureAnonAuth()
  const ref = doc(col, 'default')
  const path = `values.${age}.${boatType}`
  const payload: UpdateData<Gearing> = stripUndefined({ [path]: code, ...buildUpdateAudit(coach) })
  await updateDoc(ref, payload)
}

function toGearingMatrix(value: unknown): GearingMatrix {
  const root = asRecord(value)
  const result: GearingMatrix = {}
  Object.entries(root).forEach(([age, boats]) => {
    const boatMap = asRecord(boats)
    result[age] = {}
    Object.entries(boatMap).forEach(([boatType, code]) => {
      result[age][boatType] = asString(code ?? '')
    })
  })
  return result
}


