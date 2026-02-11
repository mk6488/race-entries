import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import { assertAuthed, requireFields, requireNonEmpty } from '../shared/assert';
import { REGION, admin, db } from '../shared/config';
import { internal, isHttpsError, permissionDenied } from '../shared/errors';

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
    try {
      const uid = assertAuthed(context);
      requireFields(data, ['firstName', 'lastName', 'pin']);

      const firstName = requireNonEmpty(data?.firstName, 'firstName');
      const lastName = requireNonEmpty(data?.lastName, 'lastName');
      const pin = requireNonEmpty(data?.pin, 'pin');
      const deviceLabel = String(data?.deviceLabel || '').trim() || null;

      const displayName = `${firstName} ${lastName}`.trim();
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
        throw permissionDenied('Incorrect PIN.');
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const email =
        typeof context.auth?.token?.email === 'string' && context.auth.token.email.trim()
          ? context.auth.token.email.trim()
          : null;

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
      );

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
        );

      return { coachId: uid, coachName: displayName };
    } catch (err: unknown) {
      if (isHttpsError(err)) throw err;
      throw internal();
    }
  });
