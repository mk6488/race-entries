import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { useState } from 'react'

export function Layout() {
  const [open, setOpen] = useState(false)
  const match = useMatch('/entries/:raceId')
  const raceId = match?.params?.raceId
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Race Entries</div>
        {raceId ? (
          <nav className="nav-links">
            <NavLink to="/" end>← Back to races</NavLink>
            <NavLink to={`/entries/${raceId}`}>Entries</NavLink>
            <NavLink to={`/races/${raceId}`}>Races</NavLink>
            <NavLink to={`/equipment/${raceId}`}>Equipment</NavLink>
            <NavLink to={`/trailer/${raceId}`}>Trailer</NavLink>
          </nav>
        ) : (
          <div />
        )}
        {raceId ? (
          <button className="menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">☰</button>
        ) : (
          <div />
        )}
      </header>

      {raceId && (
        <div className={`nav-drawer ${open ? 'open' : ''}`}>
          <NavLink to="/" end onClick={() => setOpen(false)}>← Back to races</NavLink>
          <NavLink to={`/entries/${raceId}`} onClick={() => setOpen(false)}>Entries</NavLink>
          <NavLink to={`/races/${raceId}`} onClick={() => setOpen(false)}>Races</NavLink>
          <NavLink to={`/equipment/${raceId}`} onClick={() => setOpen(false)}>Equipment</NavLink>
          <NavLink to={`/trailer/${raceId}`} onClick={() => setOpen(false)}>Trailer</NavLink>
        </div>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  )
}


