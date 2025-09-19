import { useEffect, useState } from 'react'
import { subscribeRaces } from '../data/races'
import type { Race } from '../models/race'
import { Link } from 'react-router-dom'
import { toInputDate } from '../utils/dates'

export function Home() {
  const [races, setRaces] = useState<Race[]>([])
  useEffect(() => subscribeRaces(setRaces), [])

  return (
    <div>
      <div className="card" style={{ marginTop: 4 }}>
        <h1 style={{ marginTop: 0 }}>Select a race</h1>
        <div className="race-grid">
          {races.map((r) => {
            const start = toInputDate(r.startDate)
            const end = r.endDate ? toInputDate(r.endDate) : null
            const dateLabel = end && end !== start ? `${start} → ${end}` : start
            return (
              <Link to={`/entries/${r.id}`} className="race-card" key={r.id}>
                <div className="race-date">{dateLabel}</div>
                <div className="race-name">{r.name}</div>
                <div className="race-details">{r.details || 'No details'}</div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}


