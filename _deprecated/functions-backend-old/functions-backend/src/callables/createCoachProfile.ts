import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import { assertAuthed, requireFields, requireNonEmpty } from '../shared/assert';
import { REGION, admin, db } from '../shared/config';
import { internal, isHttpsError } from '../shared/errors';

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
    try {
      const uid = assertAuthed(context);
      requireFields(data, ['firstName', 'lastName', 'pin']);

      const firstName = requireNonEmpty(data?.firstName, 'firstName');
      const lastName = requireNonEmpty(data?.lastName, 'lastName');
      const pin = requireNonEmpty(data?.pin, 'pin');
      const deviceLabel = String(data?.deviceLabel || '').trim() || null;

      const displayName = `${firstName} ${lastName}`.trim();
      const nameKey = buildNameKey(firstName, lastName);

      // Optional: prevent accidental duplicates (soft check)
      const existing = await db
        .collection('coaches')
        .where('nameKey', '==', nameKey)
        .limit(3)
        .get();
      if (
        !existing.empty &&
        // Allow idempotent re-run for same uid (canonical doc id), but keep legacy behavior otherwise.
        !(existing.size === 1 && existing.docs[0].id === uid)
      ) {
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

      // Canonical location: coaches/{uid}
      const coachRef = db.collection('coaches').doc(uid);
      const coachId = uid;

      const secret = hashPin(pin);
      const now = admin.firestore.FieldValue.serverTimestamp();
      const email =
        typeof context.auth?.token?.email === 'string' && context.auth.token.email.trim()
          ? context.auth.token.email.trim()
          : null;

      const batch = db.batch();

      batch.set(coachRef, {
        uid,
        displayName,
        email,
        firstName,
        lastName,
        nameKey,
        createdAt: now,
        updatedAt: now,
      });

      batch.set(db.collection('coachSecrets').doc(coachId), {
        ...secret,
        createdAt: now,
        updatedAt: now,
      });

      batch.set(
        db.collection('devices').doc(uid),
        {
          coachId,
          coachName: displayName,
          ...(deviceLabel ? { deviceLabel } : {}),
          createdAt: now,
          lastSeenAt: now,
        },
        { merge: true },
      );

      await batch.commit();

      return { coachId, coachName: `${firstName} ${lastName}` };
    } catch (err: unknown) {
      if (isHttpsError(err)) throw err;
      throw internal();
    }
  });
