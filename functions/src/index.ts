import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2/options'

// Deterministic deploy target: Gen2 (v2) functions in europe-west2.
export const REGION = 'europe-west2'
setGlobalOptions({ region: REGION })

initializeApp()
const db = getFirestore()

type PinSecret = {
  saltHex: string
  hashHex: string
  iterations: number
  keylen: number
  digest: string
}

function requireAuthUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.')
  return uid
}

function requireNonEmpty(value: unknown, fieldName: string): string {
  const v = String(value || '').trim()
  if (!v) throw new HttpsError('invalid-argument', `Missing or empty field: ${fieldName}`)
  return v
}

function normaliseNamePart(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function buildNameKey(firstName: unknown, lastName: unknown): string {
  const f = normaliseNamePart(firstName)
  const l = normaliseNamePart(lastName)
  return `${f}|${l}`
}

function hashPin(pin: unknown, saltHex?: string): PinSecret {
  const iterations = 120000
  const keylen = 64
  const digest = 'sha512'

  const salt = saltHex ? Buffer.from(saltHex, 'hex') : randomBytes(16)
  const derived = pbkdf2Sync(String(pin), salt, iterations, keylen, digest)

  return {
    saltHex: salt.toString('hex'),
    hashHex: derived.toString('hex'),
    iterations,
    keylen,
    digest,
  }
}

function verifyPin(pin: unknown, secret: PinSecret): boolean {
  const { saltHex, iterations, keylen, digest, hashHex } = secret
  const derived = pbkdf2Sync(String(pin), Buffer.from(saltHex, 'hex'), iterations, keylen, digest)
  const candidate = derived.toString('hex')

  const a = Buffer.from(candidate, 'hex')
  const b = Buffer.from(hashHex, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const createCoachProfile = onCall(async (request) => {
  const uid = requireAuthUid(request.auth?.uid)

  const firstName = requireNonEmpty((request.data as any)?.firstName, 'firstName')
  const lastName = requireNonEmpty((request.data as any)?.lastName, 'lastName')
  const pin = requireNonEmpty((request.data as any)?.pin, 'pin')
  const deviceLabel = String((request.data as any)?.deviceLabel || '').trim() || null

  const displayName = `${firstName} ${lastName}`.trim()
  const nameKey = buildNameKey(firstName, lastName)

  // Canonical location: coaches/{uid}
  const coachRef = db.collection('coaches').doc(uid)
  const coachId = uid
  const secretRef = db.collection('coachSecrets').doc(coachId)
  const deviceRef = db.collection('devices').doc(uid)

  const secret = hashPin(pin)
  const now = FieldValue.serverTimestamp()
  const email =
    typeof request.auth?.token?.email === 'string' && request.auth.token.email.trim()
      ? request.auth.token.email.trim()
      : null

  const batch = db.batch()
  batch.set(coachRef, {
    uid,
    displayName,
    email,
    firstName,
    lastName,
    nameKey,
    createdAt: now,
    updatedAt: now,
  })
  batch.set(secretRef, { ...secret, createdAt: now, updatedAt: now })
  batch.set(
    deviceRef,
    {
      coachId,
      coachName: displayName,
      ...(deviceLabel ? { deviceLabel } : {}),
      createdAt: now,
      lastSeenAt: now,
    },
    { merge: true },
  )

  await batch.commit()
  return { coachId, coachName: displayName }
})

export const linkDeviceToCoach = onCall(async (request) => {
  const uid = requireAuthUid(request.auth?.uid)
  const firstName = requireNonEmpty((request.data as any)?.firstName, 'firstName')
  const lastName = requireNonEmpty((request.data as any)?.lastName, 'lastName')
  const pin = requireNonEmpty((request.data as any)?.pin, 'pin')
  const deviceLabel = String((request.data as any)?.deviceLabel || '').trim() || null

  const displayName = `${firstName} ${lastName}`.trim()
  const nameKey = buildNameKey(firstName, lastName)

  // For now, keep legacy "find by nameKey" behavior so existing coachSecrets can still be used.
  const qs = await db.collection('coaches').where('nameKey', '==', nameKey).limit(5).get()
  if (qs.empty) throw new HttpsError('not-found', 'No coach profile found for that name.')
  if (qs.size > 1) {
    throw new HttpsError('failed-precondition', 'Multiple coach profiles match that name.', {
      multipleMatches: true,
      matches: qs.docs.map((d) => ({
        coachId: d.id,
        firstName: (d.data() as any)?.firstName,
        lastName: (d.data() as any)?.lastName,
      })),
    })
  }

  const legacyCoachId = qs.docs[0].id
  const secretSnap = await db.collection('coachSecrets').doc(legacyCoachId).get()
  if (!secretSnap.exists) {
    throw new HttpsError('failed-precondition', 'Coach PIN is not set up. Contact an admin.')
  }

  const secret = secretSnap.data() as PinSecret
  if (!verifyPin(pin, secret)) {
    throw new HttpsError('permission-denied', 'Incorrect PIN.')
  }

  const now = FieldValue.serverTimestamp()
  const email =
    typeof request.auth?.token?.email === 'string' && request.auth.token.email.trim()
      ? request.auth.token.email.trim()
      : null

  // Canonical location: coaches/{uid}
  await db.collection('coaches').doc(uid).set(
    {
      uid,
      displayName,
      email,
      firstName,
      lastName,
      nameKey,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )

  await db
    .collection('devices')
    .doc(uid)
    .set(
      {
        coachId: uid,
        coachName: displayName,
        ...(deviceLabel ? { deviceLabel } : {}),
        lastSeenAt: now,
      },
      { merge: true },
    )

  return { coachId: uid, coachName: displayName }
})

export const touchDevice = onCall(async (request) => {
  const uid = requireAuthUid(request.auth?.uid)
  const deviceLabel = String((request.data as any)?.deviceLabel || '').trim() || null

  await db
    .collection('devices')
    .doc(uid)
    .set(
      {
        ...(deviceLabel ? { deviceLabel } : {}),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

  return { ok: true }
})

export const healthcheck = onCall(async (request) => {
  const uid = request.auth?.uid ?? null
  return {
    ok: true,
    region: REGION,
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'unknown',
    time: new Date().toISOString(),
    authed: Boolean(uid),
    ...(uid ? { uid } : {}),
  }
})

