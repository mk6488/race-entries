import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth'
import type { User } from 'firebase/auth'

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

  function waitForFirstAuthState(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub()
        resolve(user ?? null)
      })
    })
  }

  const firstUser = await waitForFirstAuthState()
  if (import.meta.env.DEV) {
    console.info('[auth] resolved', {
      uid: firstUser?.uid ?? null,
      isAnonymous: firstUser?.isAnonymous ?? false,
      intendedPersistence,
    })
  }

  if (firstUser) {
    if (import.meta.env.DEV) {
      console.info('[auth] reuse existing user', { uid: firstUser.uid, isAnonymous: firstUser.isAnonymous })
    }
    return
  }

  if (import.meta.env.DEV) {
    console.info('[auth] signInAnonymously (no existing user)')
  }

  try {
    await signInAnonymously(auth)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[auth] signInAnonymously failed', err)
    }
    return
  }

  const authedUser = await waitForFirstAuthState()
  if (import.meta.env.DEV) {
    console.info('[auth] ready', {
      uid: authedUser?.uid ?? null,
      isAnonymous: authedUser?.isAnonymous ?? false,
      intendedPersistence,
    })
  }
})()


