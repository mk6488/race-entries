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
const autoAnonOnLoad = import.meta.env.VITE_AUTO_ANON_AUTH_ON_LOAD === 'true'
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

function waitForFirstAuthState(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      resolve(user ?? null)
    })
  })
}

let ensureAnonInFlight: Promise<User> | null = null

export async function ensureAnonAuth(): Promise<User> {
  if (auth.currentUser) return auth.currentUser
  if (ensureAnonInFlight) return ensureAnonInFlight
  ensureAnonInFlight = (async () => {
    await authPersistenceReady
    const firstUser = await waitForFirstAuthState()
    if (firstUser) return firstUser

    if (import.meta.env.DEV) {
      console.info('[auth] ensureAnonAuth: signing in anonymously')
    }
    await signInAnonymously(auth)
    const authed = await waitForFirstAuthState()
    if (!authed) throw new Error('Anonymous sign-in did not produce a user.')
    return authed
  })().finally(() => {
    ensureAnonInFlight = null
  })
  return ensureAnonInFlight
}

export const authReady: Promise<void> = (async () => {
  await authPersistenceReady

  const firstUser = await waitForFirstAuthState()
  if (import.meta.env.DEV) {
    console.info('[auth] resolved', {
      uid: firstUser?.uid ?? null,
      isAnonymous: firstUser?.isAnonymous ?? false,
      intendedPersistence,
      autoAnonOnLoad,
    })
  }

  if (firstUser) {
    if (import.meta.env.DEV) {
      console.info('[auth] reuse existing user', { uid: firstUser.uid, isAnonymous: firstUser.isAnonymous })
    }
    return
  }

  // Optional: allow browsing without creating anon users.
  if (!autoAnonOnLoad) {
    if (import.meta.env.DEV) {
      console.info('[auth] anon sign-in deferred (no existing user)')
    }
    return
  }

  try {
    const authedUser = await ensureAnonAuth()
    if (import.meta.env.DEV) {
      console.info('[auth] ready', {
        uid: authedUser?.uid ?? null,
        isAnonymous: authedUser?.isAnonymous ?? false,
        intendedPersistence,
      })
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[auth] ensureAnonAuth failed', err)
    }
  }
})()


