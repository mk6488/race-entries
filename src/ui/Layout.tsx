import { NavLink, Outlet, useMatches, useLocation } from 'react-router-dom'
import { useState } from 'react'

export function Layout() {
  const [open, setOpen] = useState(false)
  const matches = useMatches()
  const raceId = (matches[matches.length - 1]?.params as { raceId?: string } | undefined)?.raceId
  const hasRace = !!raceId
  const location = useLocation()
  const isEntries = location.pathname.startsWith('/entries/')
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button className="menu-btn mobile-only" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">☰</button>
          {hasRace ? (
            <NavLink className="desktop-only" to="/" end>← Back to races</NavLink>
          ) : (
            <span className="desktop-only">Race Entries</span>
          )}
        </div>
        {hasRace ? (
          <nav className="nav-links">
            <NavLink to={`/entries/${raceId}`}>Entries</NavLink>
            <NavLink to={`/races/${raceId}`}>Races</NavLink>
            <NavLink to={`/equipment/${raceId}`}>Equipment</NavLink>
            <NavLink to={`/trailer/${raceId}`}>Trailer</NavLink>
          </nav>
        ) : (
          <div />
        )}
        <div className="topbar-actions">
          {isEntries && hasRace ? (
            <NavLink className="primary-btn" to={`/entries/${raceId}?add=1`}>Add Entry</NavLink>
          ) : null}
        </div>
      </header>

      <>
        <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <div className={`nav-drawer ${open ? 'open' : ''}`}>
          {hasRace ? (
            <>
              <NavLink to={`/entries/${raceId}`} onClick={() => setOpen(false)}>Entries</NavLink>
              <NavLink to={`/races/${raceId}`} onClick={() => setOpen(false)}>Races</NavLink>
              <NavLink to={`/equipment/${raceId}`} onClick={() => setOpen(false)}>Equipment</NavLink>
              <NavLink to={`/trailer/${raceId}`} onClick={() => setOpen(false)}>Trailer</NavLink>
            </>
          ) : (
            <NavLink to={`/`} onClick={() => setOpen(false)}>Home</NavLink>
          )}
        </div>
      </>

      <main>
        <Outlet />
      </main>
    </div>
  )
}


