import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './ui/Layout'
import { Entries } from './pages/Entries'
import { Race } from './pages/Race'
import { Equipment } from './pages/Equipment'
import { Trailer } from './pages/Trailer'
import { Home } from './pages/Home'
import { Archive } from './pages/Archive'
import { EquipmentOverview } from './pages/EquipmentOverview'
import './ui/global.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'archive', element: <Archive /> },
      { path: 'equipment', element: <EquipmentOverview /> },
      { path: 'races/:raceId', element: <Race /> },
      { path: 'entries/:raceId', element: <Entries /> },
      { path: 'equipment/:raceId', element: <Equipment /> },
      { path: 'trailer/:raceId', element: <Trailer /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)


