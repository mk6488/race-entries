import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useRaceId } from '../hooks/useRaceId'

export function Layout() {
  const [open, setOpen] = useState(false)
  const raceId = useRaceId()
  const hasRace = !!raceId
  const location = useLocation()
  const isEntries = location.pathname.startsWith('/entries/')
  const isRaces = location.pathname.startsWith('/races/')
  const isEquipment = location.pathname.startsWith('/equipment/')
  const isMatrix = location.pathname.startsWith('/matrix/')
  const isTrailer = location.pathname.startsWith('/trailer/')
  return (
    <div className={`app-shell ${hasRace ? 'has-race' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <button className="menu-btn mobile-only" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">☰</button>
          {/* Logo moved to watermark in background */}
          {hasRace ? (
            <>
              <NavLink className="desktop-only home-link" to="/" end aria-label="Home">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H10v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                </svg>
              </NavLink>
              <NavLink className="mobile-only home-link" to="/" end aria-label="Home">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H10v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                </svg>
              </NavLink>
            </>
          ) : (
            <span className="desktop-only">Race Entries</span>
          )}
        </div>
        {hasRace ? (
          <nav className="nav-links">
            <NavLink to={`/entries/${raceId}`}>Entries</NavLink>
            <NavLink to={`/matrix/${raceId}`}>Matrix</NavLink>
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
          {(hasRace && (isRaces || isEquipment || isTrailer || isMatrix)) ? (
            <button className="primary-btn" onClick={() => window.print()} aria-label="Print races table">Print</button>
          ) : null}
        </div>
      </header>

      <>
        <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <div className={`nav-drawer ${open ? 'open' : ''}`}>
          {hasRace ? (
            <>
              <NavLink to={`/entries/${raceId}`} onClick={() => setOpen(false)}>Entries</NavLink>
              <NavLink to={`/matrix/${raceId}`} onClick={() => setOpen(false)}>Matrix</NavLink>
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


