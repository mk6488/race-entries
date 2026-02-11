import * as functions from 'firebase-functions';
import { httpsError } from './errors';

export function assertAuthed(context: functions.https.CallableContext): string {
  if (!context.auth || !context.auth.uid) {
    throw httpsError('unauthenticated', 'You must be signed in.');
  }
  return context.auth.uid;
}

export function requireNonEmpty(value: unknown, fieldName: string): string {
  const v = String(value || '').trim();
  if (!v) {
    throw httpsError('invalid-argument', `Missing or empty field: ${fieldName}`);
  }
  return v;
}
