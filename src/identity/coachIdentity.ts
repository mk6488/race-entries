import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'

export type CoachProfile = {
  coachId: string
  firstName: string
  lastName: string
  nameKey: string
}

export type DeviceLink = {
  coachId: string
  deviceLabel?: string
}

export type CoachMatch = {
  coachId: string
  firstName: string
  lastName: string
  createdAt?: string
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function makeNameKey(firstName: string, lastName: string): string {
  return `${normalizeName(firstName)}|${normalizeName(lastName)}`
}

export async function getDeviceLink(uid: string): Promise<DeviceLink | null> {
  const snap = await getDoc(doc(db, 'devices', uid))
  if (!snap.exists()) return null
  const data = snap.data() as Record<string, unknown>
  const coachId = typeof data.coachId === 'string' ? data.coachId : ''
  if (!coachId) return null
  const deviceLabel = typeof data.deviceLabel === 'string' ? data.deviceLabel : undefined
  return { coachId, deviceLabel }
}

export async function getCoach(coachId: string): Promise<CoachProfile | null> {
  const snap = await getDoc(doc(db, 'coaches', coachId))
  if (!snap.exists()) return null
  const data = snap.data() as Record<string, unknown>
  return {
    coachId: snap.id,
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    nameKey: typeof data.nameKey === 'string' ? data.nameKey : '',
  }
}

type CreateCoachInput = {
  firstName: string
  lastName: string
  pin: string
  deviceLabel?: string
}

type LinkCoachInput = {
  firstName: string
  lastName: string
  pin: string
  deviceLabel?: string
  coachId?: string
}

type LinkCoachResponse = {
  coachId?: string
  requiresPick?: boolean
  matches?: CoachMatch[]
}

const createCoachProfileCallable = httpsCallable<CreateCoachInput, { coachId: string }>(functions, 'createCoachProfile')
const linkDeviceCallable = httpsCallable<LinkCoachInput, LinkCoachResponse>(functions, 'linkDeviceToCoach')
const touchDeviceCallable = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'touchDevice')

export async function createCoachProfile(input: CreateCoachInput): Promise<{ coachId: string }> {
  const res = await createCoachProfileCallable(input)
  return res.data
}

export async function linkDeviceToCoach(input: LinkCoachInput): Promise<LinkCoachResponse> {
  const res = await linkDeviceCallable(input)
  return res.data
}

export async function touchDevice(): Promise<{ ok: boolean }> {
  const res = await touchDeviceCallable({})
  return res.data
}
