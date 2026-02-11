import * as functions from 'firebase-functions';
import { assertAuthed } from '../shared/assert';
import { REGION, admin, db } from '../shared/config';
import { internal, isHttpsError } from '../shared/errors';

/**
 * touchDevice
 * Input: { deviceLabel? }
 * Output: { ok: true }
 *
 * Updates devices/{uid}.lastSeenAt (and deviceLabel if provided)
 */
export const touchDevice = functions.region(REGION).https.onCall(async (data: any, context) => {
  try {
    const uid = assertAuthed(context);

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
  } catch (err: unknown) {
    if (isHttpsError(err)) throw err;
    throw internal();
  }
});
