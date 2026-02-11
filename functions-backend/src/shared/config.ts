import * as admin from 'firebase-admin';

// ✅ Keep your region consistent (UK latency)
export const REGION = 'europe-west2';

// Admin SDK is initialized once per cold start (module scope).
admin.initializeApp();

export { admin };
export const db = admin.firestore();
