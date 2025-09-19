import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Race Entries</div>
        <nav className="nav-links">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/races">Races</NavLink>
          <NavLink to="/entries">Entries</NavLink>
        </nav>
        <button className="menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">☰</button>
      </header>

      <div className={`nav-drawer ${open ? 'open' : ''}`}>
        <NavLink to="/" end onClick={() => setOpen(false)}>Home</NavLink>
        <NavLink to="/races" onClick={() => setOpen(false)}>Races</NavLink>
        <NavLink to="/entries" onClick={() => setOpen(false)}>Entries</NavLink>
      </div>

      <main>
        <Outlet />
      </main>
    </div>
  )
}


