import * as functions from 'firebase-functions';
import { badRequest, unauthenticated } from './errors';

export function assertAuthed(context: functions.https.CallableContext): string {
  if (!context.auth || !context.auth.uid) {
    throw unauthenticated();
  }
  return context.auth.uid;
}

export function requireNonEmpty(value: unknown, fieldName: string): string {
  const v = String(value || '').trim();
  if (!v) {
    throw badRequest(`Missing or empty field: ${fieldName}`);
  }
  return v;
}

export function requireFields(
  data: unknown,
  fields: ReadonlyArray<string>,
): asserts data is Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    throw badRequest('Missing request data.');
  }

  for (const field of fields) {
    const value = (data as Record<string, unknown>)[field];
    // Leave strict per-field validation to requireNonEmpty / other validators.
    if (value === undefined) {
      throw badRequest(`Missing field: ${field}`);
    }
  }
}
