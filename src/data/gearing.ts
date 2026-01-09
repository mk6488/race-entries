import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db, authReady } from '../firebase'
import type { GearingMatrix } from '../models/firestore'
import { asRecord, asString } from './firestoreMapping'
import { logWarn } from '../utils/log'
export type { GearingMatrix }

const col = collection(db, 'gearing')

export function subscribeGearing(raceId: string, cb: (values: GearingMatrix) => void) {
  const ref = doc(col, raceId)
  return onSnapshot(ref, (snap) => {
    try {
      const data = snap.exists() ? snap.data() : {}
      cb(toGearingMatrix(asRecord(data).values))
    } catch (err) {
      logWarn('gearing.toGearingMatrix', err)
      cb({})
    }
  })
}

export async function initGearingIfMissing(raceId: string, initial: GearingMatrix) {
  await authReady.catch(() => {})
  const ref = doc(col, raceId)
  await setDoc(ref, { values: initial }, { merge: true })
}

export async function updateGearingCell(raceId: string, age: string, boatType: string, code: string) {
  await authReady.catch(() => {})
  const ref = doc(col, raceId)
  const path = `values.${age}.${boatType}`
  await updateDoc(ref, { [path]: code })
}

// Global (non-race) gearing defaults stored under doc id 'default'
export function subscribeGlobalGearing(cb: (values: GearingMatrix) => void) {
  const ref = doc(col, 'default')
  return onSnapshot(ref, (snap) => {
    try {
      const data = snap.exists() ? snap.data() : {}
      cb(toGearingMatrix(asRecord(data).values))
    } catch (err) {
      logWarn('gearing.global.toGearingMatrix', err)
      cb({})
    }
  })
}

export async function initGlobalGearingIfMissing(initial: GearingMatrix) {
  await authReady.catch(() => {})
  const ref = doc(col, 'default')
  const snap = await getDoc(ref)
  const existing = snap.exists() ? (snap.data() as any) : null
  if (!existing || !existing.values) {
    await setDoc(ref, { values: initial }, { merge: false })
  }
}

export async function updateGlobalGearingCell(age: string, boatType: string, code: string) {
  await authReady.catch(() => {})
  const ref = doc(col, 'default')
  const path = `values.${age}.${boatType}`
  await updateDoc(ref, { [path]: code })
}

function toGearingMatrix(value: unknown): GearingMatrix {
  const root = asRecord(value)
  const result: GearingMatrix = {}
  Object.entries(root).forEach(([age, boats]) => {
    const boatMap = asRecord(boats)
    result[age] = {}
    Object.entries(boatMap).forEach(([boatType, code]) => {
      result[age][boatType] = asString(code)
    })
  })
  return result
}


