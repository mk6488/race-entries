import { ReactNode } from 'react'
import { useIsAdmin } from '../auth/admin'
import { LoadingState } from './components/LoadingState'
import { Link } from 'react-router-dom'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, isAdmin } = useIsAdmin()

  if (status === 'loading') {
    return <LoadingState label="Checking access..." />
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Not authorised</h2>
        <p>This area is for admins only.</p>
        <Link to="/">Go home</Link>
      </div>
    )
  }

  return <>{children}</>
}
