import { ReactNode } from 'react'
import { useAdminStatus } from '../auth/adminAuth'
import { LoadingState } from './components/LoadingState'
import { Link } from 'react-router-dom'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, isAdmin } = useAdminStatus()

  if (status === 'loading') {
    return <LoadingState label="Checking access..." />
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Not authorised</h2>
        <p>This area is for admins only.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/">Go home</Link>
          <Link to="/admin/login">Sign in as admin</Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
