import { useEffect, useState } from 'react'
import { subscribeRaces, updateRace } from '../data/races'
import type { Race } from '../models/race'
import { Link } from 'react-router-dom'
import { formatUiDate } from '../utils/dates'

export function Archive() {
  const [races, setRaces] = useState<Race[]>([])
  useEffect(() => subscribeRaces(setRaces), [])

  const archived = races.filter(r => r.archived)

  return (
    <div>
      <div className="card" style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Archived races</h1>
          <Link to="/" className="secondary-btn">Back</Link>
        </div>
        {archived.length === 0 ? (
          <div style={{ color: 'var(--muted)', marginTop: 8 }}>No archived races yet.</div>
        ) : (
          <div className="race-grid">
            {archived.map((r) => {
              const start = formatUiDate(r.startDate)
              const end = r.endDate ? formatUiDate(r.endDate) : null
              const dateLabel = end && end !== start ? `${start} → ${end}` : start
              return (
                <div className="race-card" key={r.id}>
                  <Link to={`/entries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="race-date">{dateLabel}</div>
                    <div className="race-name">{r.name}</div>
                    <div className="race-details">{r.details || 'No details'}</div>
                  </Link>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button
                      className="secondary-btn"
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await updateRace(r.id, { archived: false })
                        } catch (err) {
                          alert('Failed to unarchive race. Please try again.')
                          console.error(err)
                        }
                      }}
                    >
                      Unarchive
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


