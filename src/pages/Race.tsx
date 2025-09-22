import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Entry } from '../models/entry'
import { subscribeEntries } from '../data/entries'
import { getRaceById } from '../data/races'
import type { Race as RaceType } from '../models/race'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'

export function Race() {
  const { raceId } = useParams()
  const [race, setRace] = useState<RaceType | null>(null)
  const [rows, setRows] = useState<Entry[]>([])

  // Plain table — no filters/sorting

  useEffect(() => {
    if (!raceId) return
    return subscribeEntries(raceId, setRows)
  }, [raceId])

  useEffect(() => {
    if (!raceId) return
    ;(async () => {
      const r = await getRaceById(raceId)
      setRace(r)
    })()
  }, [raceId])

  const dayOptions = useMemo(() => {
    if (!race) return [] as string[]
    return enumerateDaysInclusive(race.startDate, race.endDate).map(formatDayLabel)
  }, [race])

  const enteredRows = useMemo(() => rows.filter((r) => r.status === 'entered'), [rows])

  const plainRows = enteredRows

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{race?.name ?? 'Race'}</h1>
      {race && (
        <div style={{ color: 'var(--muted)', marginBottom: 12 }}>
          {(() => {
            const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
            const start = race.startDate
            const end = race.endDate
            return end && end.getTime() !== start.getTime() ? `${fmt(start)} → ${fmt(end)}` : fmt(start)
          })()}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="sheet">
          <thead>
            <tr>
              <th style={{ minWidth: 90 }}>Day</th>
              <th style={{ minWidth: 70 }}>Div</th>
              <th style={{ minWidth: 140 }}>Event</th>
              <th style={{ minWidth: 320 }}>Athlete Names</th>
              <th style={{ minWidth: 160 }}>Boat</th>
              <th style={{ minWidth: 120 }}>Blades</th>
            </tr>
          </thead>
          <tbody>
            {plainRows.map((r) => (
              <tr key={r.id}>
                <td>{r.day}</td>
                <td>{r.div}</td>
                <td>{r.event}</td>
                <td>{r.athleteNames}</td>
                <td>{r.boat}</td>
                <td>{r.blades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


