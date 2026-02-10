import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2/options'

setGlobalOptions({ region: 'europe-west2' })

if (!getApps().length) {
  initializeApp()
}

const db = getFirestore()
const PIN_PATTERN = /^\d{4}$/
const PIN_ITERATIONS = 150000
const PIN_ALGO = 'pbkdf2-sha256'
const PIN_DIGEST = 'sha256'
const PIN_KEYLEN = 32

type CoachDoc = {
  firstName: string
  lastName: string
  nameKey: string
  createdAt: FieldValue
}

function requireAuthUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required.')
  return uid
}

function cleanName(name: unknown, label: string): string {
  const value = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''
  if (!value) throw new HttpsError('invalid-argument', `${label} is required.`)
  if (value.length > 80) throw new HttpsError('invalid-argument', `${label} is too long.`)
  return value
}

function normalizeNamePart(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function toNameKey(firstName: string, lastName: string): string {
  return `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}`
}

function cleanPin(pin: unknown): string {
  const value = typeof pin === 'string' ? pin.trim() : ''
  if (!PIN_PATTERN.test(value)) {
    throw new HttpsError('invalid-argument', 'PIN must be exactly 4 digits.')
  }
  return value
}

function cleanDeviceLabel(label: unknown): string | undefined {
  if (label === undefined || label === null || label === '') return undefined
  if (typeof label !== 'string') throw new HttpsError('invalid-argument', 'deviceLabel must be a string.')
  const value = label.trim()
  if (!value) return undefined
  if (value.length > 80) throw new HttpsError('invalid-argument', 'deviceLabel is too long.')
  return value
}

function hashPin(pin: string): { saltHex: string; hashHex: string } {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(pin, salt, PIN_ITERATIONS, PIN_KEYLEN, PIN_DIGEST)
  return { saltHex: salt.toString('hex'), hashHex: hash.toString('hex') }
}

function verifyPin(pin: string, saltHex: string, hashHex: string, iterations: number): boolean {
  const expected = Buffer.from(hashHex, 'hex')
  const actual = pbkdf2Sync(pin, Buffer.from(saltHex, 'hex'), iterations, expected.length, PIN_DIGEST)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

function timestampToIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  return undefined
}

export const createCoachProfile = onCall(async (request) => {
  const uid = requireAuthUid(request.auth?.uid)
  const payload = (request.data || {}) as Record<string, unknown>

  const firstName = cleanName(payload.firstName, 'firstName')
  const lastName = cleanName(payload.lastName, 'lastName')
  const pin = cleanPin(payload.pin)
  const deviceLabel = cleanDeviceLabel(payload.deviceLabel)
  const nameKey = toNameKey(firstName, lastName)

  const coachRef = db.collection('coaches').doc()
  const secretRef = db.collection('coachSecrets').doc(coachRef.id)
  const deviceRef = db.collection('devices').doc(uid)

  const { saltHex, hashHex } = hashPin(pin)
  const now = FieldValue.serverTimestamp()

  const coach: CoachDoc = { firstName, lastName, nameKey, createdAt: now }
  const batch = db.batch()
  batch.set(coachRef, coach)
  batch.set(secretRef, {
    pinSalt: saltHex,
    pinHash: hashHex,
    pinIterations: PIN_ITERATIONS,
    pinAlgo: PIN_ALGO,
    createdAt: now,
  })
  batch.set(deviceRef, {
    coachId: coachRef.id,
    ...(deviceLabel ? { deviceLabel } : {}),
    createdAt: now,
    lastSeenAt: now,
  })
  await batch.commit()

  return { coachId: coachRef.id }
})

export const linkDeviceToCoach = onCall(async (request) => {
  const uid = requireAuthUid(request.auth?.uid)
  const payload = (request.data || {}) as Record<string, unknown>

  const firstName = cleanName(payload.firstName, 'firstName')
  const lastName = cleanName(payload.lastName, 'lastName')
  const pin = cleanPin(payload.pin)
  const deviceLabel = cleanDeviceLabel(payload.deviceLabel)
  const requestedCoachId = typeof payload.coachId === 'string' && payload.coachId.trim() ? payload.coachId.trim() : undefined
  const nameKey = toNameKey(firstName, lastName)

  let coachId = requestedCoachId
  if (!coachId) {
    const snap = await db.collection('coaches').where('nameKey', '==', nameKey).limit(10).get()
    if (snap.empty) throw new HttpsError('not-found', 'No coach found')
    if (snap.size > 1) {
      return {
        requiresPick: true,
        matches: snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          return {
            coachId: d.id,
            firstName: typeof data.firstName === 'string' ? data.firstName : '',
            lastName: typeof data.lastName === 'string' ? data.lastName : '',
            createdAt: timestampToIso(data.createdAt),
          }
        }),
      }
    }
    coachId = snap.docs[0].id
  }

  const coachRef = db.collection('coaches').doc(coachId)
  const coachSnap = await coachRef.get()
  if (!coachSnap.exists) throw new HttpsError('not-found', 'No coach found')
  const coachData = coachSnap.data() as Record<string, unknown>
  if (typeof coachData.nameKey !== 'string' || coachData.nameKey !== nameKey) {
    throw new HttpsError('invalid-argument', 'Coach details do not match.')
  }

  const secretRef = db.collection('coachSecrets').doc(coachId)
  const secretSnap = await secretRef.get()
  if (!secretSnap.exists) throw new HttpsError('failed-precondition', 'Coach secret record missing.')
  const secretData = secretSnap.data() as Record<string, unknown>
  const salt = typeof secretData.pinSalt === 'string' ? secretData.pinSalt : ''
  const hash = typeof secretData.pinHash === 'string' ? secretData.pinHash : ''
  const iterations = typeof secretData.pinIterations === 'number' ? secretData.pinIterations : PIN_ITERATIONS
  if (!salt || !hash || !verifyPin(pin, salt, hash, iterations)) {
    throw new HttpsError('permission-denied', 'Invalid PIN')
  }

  const deviceRef = db.collection('devices').doc(uid)
  const deviceSnap = await deviceRef.get()
  const existingData = deviceSnap.exists ? (deviceSnap.data() as Record<string, unknown>) : null
  const now = FieldValue.serverTimestamp()

  if (existingData && existingData.coachId === coachId) {
    await deviceRef.set(
      {
        ...(deviceLabel ? { deviceLabel } : {}),
        lastSeenAt: now,
      },
      { merge: true },
    )
    return { coachId }
  }

  await deviceRef.set({
    coachId,
    ...(deviceLabel ? { deviceLabel } : {}),
    createdAt: existingData?.createdAt ?? now,
    lastSeenAt: now,
  })
  return { coachId }
})

export const touchDevice = onCall(async (request) => {
  const uid = requireAuthUid(request.auth?.uid)
  const ref = db.collection('devices').doc(uid)
  const snap = await ref.get()
  if (snap.exists) {
    await ref.set({ lastSeenAt: FieldValue.serverTimestamp() }, { merge: true })
  }
  return { ok: true }
})
