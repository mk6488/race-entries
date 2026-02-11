import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
const intendedPersistence = 'browserLocalPersistence'
export const authPersistenceReady: Promise<void> = (async () => {
  try {
    // Must run before any sign-in calls to ensure the session survives tab close/reopen.
    await setPersistence(auth, browserLocalPersistence)
  } catch (err) {
    // Don't block app usage if persistence fails (e.g. Safari private mode).
    if (import.meta.env.DEV) {
      console.warn('[auth] setPersistence failed', err)
    }
  }
})()

export const authReady: Promise<void> = (async () => {
  await authPersistenceReady
  await auth.authStateReady()
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth)
    } catch {
      // Swallow errors to match previous behaviour
    }
    await auth.authStateReady()
  }
  if (import.meta.env.DEV) {
    console.info('[auth] ready', { uid: auth.currentUser?.uid ?? null, intendedPersistence })
  }
})()


