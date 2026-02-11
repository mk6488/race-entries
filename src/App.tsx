import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './ui/Layout'
import { Entries } from './pages/Entries'
import { Race } from './pages/Race'
import { Equipment } from './pages/Equipment'
import { Matrix } from './pages/Matrix'
import { Trailer } from './pages/Trailer'
import { Home } from './pages/Home'
import { Archive } from './pages/Archive'
// removed EquipmentOverview
import { EquipmentBoats } from './pages/EquipmentBoats'
import { EquipmentBlades } from './pages/EquipmentBlades'
import { Diagnostics } from './pages/Diagnostics'
import { AdminLogin } from './pages/AdminLogin'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { RequireAdmin } from './ui/RequireAdmin'
import { useCoachContext } from './coach/useCoachContext'
import { CoachOnboardingModal } from './coach/CoachOnboardingModal'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
          { path: 'admin/login', element: <AdminLogin /> },
      { path: 'archive', element: <Archive /> },
      { path: 'boats', element: <EquipmentBoats /> },
      { path: 'blades', element: <EquipmentBlades /> },
      { path: 'races/:raceId', element: <Race /> },
      { path: 'matrix/:raceId', element: <Matrix /> },
      { path: 'entries/:raceId', element: <Entries /> },
      { path: 'equipment/:raceId', element: <Equipment /> },
      { path: 'trailer/:raceId', element: <Trailer /> },
      { path: 'diagnostics', element: <RequireAdmin><Diagnostics /></RequireAdmin> },
    ],
  },
])

export function App() {
  const { ctx, refresh } = useCoachContext()
  return (
    <ErrorBoundary>
      <CoachOnboardingModal ctx={ctx} refresh={refresh} />
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}


