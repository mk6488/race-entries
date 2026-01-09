import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
// Persist auth across reloads when supported
setPersistence(auth, browserLocalPersistence).catch(() => {})

let authResolved = false
export const authReady: Promise<void> = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    if (authResolved) return
    if (user) {
      authResolved = true
      resolve()
      return
    }
    try {
      await signInAnonymously(auth)
    } catch {
      // Ignore; still resolve to avoid hanging
    } finally {
      authResolved = true
      resolve()
    }
  })
})


