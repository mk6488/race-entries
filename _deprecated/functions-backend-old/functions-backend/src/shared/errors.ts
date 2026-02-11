import * as functions from 'firebase-functions';

export function badRequest(message: string, details?: unknown): functions.https.HttpsError {
  return new functions.https.HttpsError('invalid-argument', message, details);
}

export function unauthenticated(message = 'You must be signed in.'): functions.https.HttpsError {
  return new functions.https.HttpsError('unauthenticated', message);
}

export function permissionDenied(message: string, details?: unknown): functions.https.HttpsError {
  return new functions.https.HttpsError('permission-denied', message, details);
}

export function internal(message = 'Internal error.'): functions.https.HttpsError {
  return new functions.https.HttpsError('internal', message);
}

export function isHttpsError(err: unknown): err is functions.https.HttpsError {
  return err instanceof functions.https.HttpsError;
}
