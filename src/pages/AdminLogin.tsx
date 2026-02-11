import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, authPersistenceReady } from '../firebase'
import { isAdminUser, useAdminStatus } from '../auth/adminAuth'
import { PageHeader } from '../ui/components/PageHeader'
import { Field } from '../ui/components/Field'
import { Button } from '../ui/components/Button'
import { ErrorBanner } from '../ui/components/ErrorBanner'

export function AdminLogin() {
  const navigate = useNavigate()
  const { status, isAdmin } = useAdminStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status === 'ready' && isAdmin) {
      navigate('/diagnostics', { replace: true })
    }
  }, [status, isAdmin, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await authPersistenceReady
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      if (isAdminUser(cred.user)) {
        navigate('/diagnostics', { replace: true })
        return
      }
      await signOut(auth)
      setError('This account is not authorised for admin access.')
    } catch (err) {
      setError('Sign-in failed. Check your email and password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="print-root" style={{ padding: 16, maxWidth: 480, margin: '0 auto', display: 'grid', gap: 12 }}>
      <PageHeader title="Admin sign-in" subtitle="Admin access only. Normal users stay anonymous." />
      {error ? <ErrorBanner message={error} /> : null}
      <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gap: 12, padding: 16 }}>
        <Field
          id="admin-email"
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="admin@example.com"
          required
        />
        <Field
          id="admin-password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </div>
      </form>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        Admins are allowlisted by email via <code>VITE_ADMIN_EMAILS</code>.
      </div>
    </div>
  )
}
