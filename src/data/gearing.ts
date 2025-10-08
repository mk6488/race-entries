import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db, authReady } from '../firebase'

export type GearingMatrix = Record<string, Record<string, string>> // age -> boatType -> code ('1'..'5'|'NA'|'')

const col = collection(db, 'gearing')

export function subscribeGearing(raceId: string, cb: (values: GearingMatrix) => void) {
  const ref = doc(col, raceId)
  return onSnapshot(ref, (snap) => {
    const data = (snap.exists() ? (snap.data() as any) : {})
    cb((data.values as GearingMatrix) || {})
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


