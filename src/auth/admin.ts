import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { auth, db, authReady } from '../firebase'

const cache = new Map<string, boolean>()

export async function isAdminUid(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false
  if (cache.has(uid)) return cache.get(uid) as boolean
  await authReady.catch(() => {})
  const ref = doc(db, 'admins', uid)
  const snap = await getDoc(ref)
  const enabled = snap.exists() && !!(snap.data() as any).enabled
  cache.set(uid, enabled)
  return enabled
}

type AdminState = { status: 'loading' | 'ready' | 'error'; isAdmin: boolean }

export function useIsAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ status: 'loading', isAdmin: false })

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      try {
        const ok = await isAdminUid(user?.uid)
        setState({ status: 'ready', isAdmin: ok })
      } catch (err) {
        setState({ status: 'error', isAdmin: false })
      }
    })
    return () => unsub()
  }, [])

  return state
}
