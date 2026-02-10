import { useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useCoachIdentity } from '../hooks/useCoachIdentity'
import { LoadingState } from './components/LoadingState'
import { ErrorBanner } from './components/ErrorBanner'
import { Onboarding } from '../pages/Onboarding'

export function RequireCoach({ children }: { children: ReactNode }) {
  const location = useLocation()
  const bypass = location.pathname.startsWith('/admin/') || location.pathname.startsWith('/diagnostics')
  const [refreshKey, setRefreshKey] = useState(0)
  const identity = useCoachIdentity(refreshKey)

  if (bypass) return <>{children}</>
  if (identity.status === 'loading') {
    return <LoadingState label="Loading coach identity..." />
  }

  if (identity.status === 'error') {
    return (
      <>
        {identity.error ? <ErrorBanner message={identity.error} /> : null}
        <Onboarding onResolved={() => setRefreshKey((v) => v + 1)} />
      </>
    )
  }

  if (identity.needsOnboarding) {
    return <Onboarding onResolved={() => setRefreshKey((v) => v + 1)} />
  }

  return <>{children}</>
}
