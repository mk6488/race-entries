import * as functions from 'firebase-functions';

export function httpsError(
  code: functions.https.FunctionsErrorCode,
  message: string,
  details?: unknown,
): functions.https.HttpsError {
  return new functions.https.HttpsError(code, message, details);
}
