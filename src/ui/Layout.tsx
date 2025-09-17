import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">Race Entries</div>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/entries">Entries</NavLink>
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">☰</button>
          <div className="spacer" />
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}


