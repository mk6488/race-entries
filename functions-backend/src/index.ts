import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();

// ✅ Keep your region consistent (UK latency)
const REGION = 'europe-west2';

// --- helpers ------------------------------------------------------

function normaliseNamePart(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildNameKey(firstName: unknown, lastName: unknown): string {
  const f = normaliseNamePart(firstName);
  const l = normaliseNamePart(lastName);
  return `${f}|${l}`;
}

type PinSecret = {
  saltHex: string;
  hashHex: string;
  iterations: number;
  keylen: number;
  digest: string;
};

function hashPin(pin: unknown, saltHex?: string): PinSecret {
  const iterations = 120000; // reasonable baseline
  const keylen = 64;
  const digest = 'sha512';

  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);

  const derived = crypto.pbkdf2Sync(String(pin), salt, iterations, keylen, digest);

  return {
    saltHex: salt.toString('hex'),
    hashHex: derived.toString('hex'),
    iterations,
    keylen,
    digest,
  };
}

function verifyPin(pin: unknown, secret: PinSecret): boolean {
  const { saltHex, iterations, keylen, digest, hashHex } = secret;
  const derived = crypto.pbkdf2Sync(
    String(pin),
    Buffer.from(saltHex, 'hex'),
    iterations,
    keylen,
    digest,
  );
  const candidate = derived.toString('hex');

  // timing-safe compare
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  return context.auth.uid;
}

function requireNonEmpty(value: unknown, fieldName: string): string {
  const v = String(value || '').trim();
  if (!v) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Missing or empty field: ${fieldName}`,
    );
  }
  return v;
}

// --- callable functions -------------------------------------------

/**
 * createCoachProfile
 * Input: { firstName, lastName, pin, deviceLabel? }
 * Output: { coachId, coachName }
 *
 * Writes:
 *  - coaches/{coachId} : { firstName, lastName, nameKey, createdAt }
 *  - coachSecrets/{coachId} : { saltHex, hashHex, iterations, keylen, digest, createdAt }
 *  - devices/{uid} : { coachId, deviceLabel?, createdAt, lastSeenAt }
 */
export const createCoachProfile = functions
  .region(REGION)
  .https.onCall(async (data: any, context) => {
    const uid = requireAuth(context);

    const firstName = requireNonEmpty(data?.firstName, 'firstName');
    const lastName = requireNonEmpty(data?.lastName, 'lastName');
    const pin = requireNonEmpty(data?.pin, 'pin');
    const deviceLabel = String(data?.deviceLabel || '').trim() || null;

    const nameKey = buildNameKey(firstName, lastName);

    // Optional: prevent accidental duplicates (soft check)
    const existing = await db.collection('coaches').where('nameKey', '==', nameKey).limit(3).get();
    if (!existing.empty) {
      // Don’t hard-block (your call); but returning a clear error helps
      throw new functions.https.HttpsError(
        'already-exists',
        'A coach profile with this name already exists. Try linking instead.',
        {
          matches: existing.docs.map((d) => ({
            coachId: d.id,
            firstName: d.data()?.firstName,
            lastName: d.data()?.lastName,
          })),
        },
      );
    }

    const coachRef = db.collection('coaches').doc();
    const coachId = coachRef.id;

    const secret = hashPin(pin);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();

    batch.set(coachRef, {
      firstName,
      lastName,
      nameKey,
      createdAt: now,
    });

    batch.set(db.collection('coachSecrets').doc(coachId), {
      ...secret,
      createdAt: now,
    });

    batch.set(
      db.collection('devices').doc(uid),
      {
        coachId,
        ...(deviceLabel ? { deviceLabel } : {}),
        createdAt: now,
        lastSeenAt: now,
      },
      { merge: true },
    );

    await batch.commit();

    return { coachId, coachName: `${firstName} ${lastName}` };
  });

/**
 * linkDeviceToCoach
 * Input: { firstName, lastName, pin, deviceLabel? }
 * Output: { coachId, coachName }
 *
 * Looks up coach by nameKey. If multiple matches -> failed-precondition with matches list.
 * Verifies pin against coachSecrets/{coachId}.
 * Writes devices/{uid}.coachId
 */
export const linkDeviceToCoach = functions
  .region(REGION)
  .https.onCall(async (data: any, context) => {
    const uid = requireAuth(context);

    const firstName = requireNonEmpty(data?.firstName, 'firstName');
    const lastName = requireNonEmpty(data?.lastName, 'lastName');
    const pin = requireNonEmpty(data?.pin, 'pin');
    const deviceLabel = String(data?.deviceLabel || '').trim() || null;

    const nameKey = buildNameKey(firstName, lastName);

    const qs = await db.collection('coaches').where('nameKey', '==', nameKey).limit(5).get();

    if (qs.empty) {
      throw new functions.https.HttpsError('not-found', 'No coach profile found for that name.');
    }

    if (qs.size > 1) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Multiple coach profiles match that name.',
        {
          matches: qs.docs.map((d) => ({
            coachId: d.id,
            firstName: d.data()?.firstName,
            lastName: d.data()?.lastName,
          })),
        },
      );
    }

    const coachDoc = qs.docs[0];
    const coachId = coachDoc.id;

    const secretSnap = await db.collection('coachSecrets').doc(coachId).get();
    if (!secretSnap.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Coach PIN is not set up. Contact an admin.',
      );
    }

    const secret = secretSnap.data() as PinSecret;
    if (!verifyPin(pin, secret)) {
      throw new functions.https.HttpsError('permission-denied', 'Incorrect PIN.');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await db
      .collection('devices')
      .doc(uid)
      .set(
        {
          coachId,
          ...(deviceLabel ? { deviceLabel } : {}),
          lastSeenAt: now,
        },
        { merge: true },
      );

    const coachName = `${coachDoc.data()?.firstName || firstName} ${coachDoc.data()?.lastName || lastName}`;
    return { coachId, coachName };
  });

/**
 * touchDevice
 * Input: { deviceLabel? }
 * Output: { ok: true }
 *
 * Updates devices/{uid}.lastSeenAt (and deviceLabel if provided)
 */
export const touchDevice = functions.region(REGION).https.onCall(async (data: any, context) => {
  const uid = requireAuth(context);

  const deviceLabel = String(data?.deviceLabel || '').trim() || null;
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db
    .collection('devices')
    .doc(uid)
    .set(
      {
        ...(deviceLabel ? { deviceLabel } : {}),
        lastSeenAt: now,
      },
      { merge: true },
    );

  return { ok: true };
});
