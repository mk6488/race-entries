import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../firebase'

type AdminStatus = { status: 'loading' | 'ready'; user: User | null; isAdmin: boolean }

const allowlist: string[] = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

function normaliseEmail(email: string | null | undefined) {
  return email ? email.trim().toLowerCase() : null
}

export function getAdminEmailAllowlist() {
  return allowlist
}

export function isAdminUser(user: User | null): boolean {
  const email = normaliseEmail(user?.email || null)
  if (!email) return false
  return allowlist.includes(email)
}

export function useAdminStatus(): AdminStatus {
  const [state, setState] = useState<AdminStatus>({ status: 'loading', user: null, isAdmin: false })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setState({ status: 'ready', user, isAdmin: isAdminUser(user) })
    })
    return () => unsub()
  }, [])

  return state
}
