import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeEntries, createEntry, updateEntry } from '../data/entries'
import { getRaceById } from '../data/races'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'
import type { Entry, NewEntry } from '../models/entry'

export function Entries() {
  const { raceId } = useParams()
  const [rows, setRows] = useState<Entry[]>([])
  const [dayOptions, setDayOptions] = useState<string[]>([])
  const boatOptions = useMemo(() => ['1x','2x','2-','2+','4x','4-','4+','8+'], [])
  const bladeOptions = useMemo(() => ['S','B','O','F','R','L'], [])

  useEffect(() => {
    if (!raceId) return
    const unsub = subscribeEntries(raceId, setRows)
    return () => unsub()
  }, [raceId])

  useEffect(() => {
    if (!raceId) return
    ;(async () => {
      const race = await getRaceById(raceId)
      if (!race) { setDayOptions([]); return }
      const days = enumerateDaysInclusive(race.startDate, race.endDate)
      setDayOptions(days.map(formatDayLabel))
    })()
  }, [raceId])

  async function addRow() {
    if (!raceId) return
    const blank: NewEntry = {
      raceId,
      day: dayOptions[0] ?? '',
      div: '',
      event: '',
      athleteNames: '',
      boat: boatOptions[0],
      blades: bladeOptions[0],
      notes: '',
      withdrawn: false,
      rejected: false,
    }
    await createEntry(blank)
  }

  async function updateCell(id: string, patch: Partial<NewEntry>) {
    await updateEntry(id, patch)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Entries</h1>
        <button onClick={addRow}>Add row</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="sheet">
          <thead>
            <tr>
              <th style={{ minWidth: 110 }}>Day</th>
              <th style={{ minWidth: 70 }}>Div</th>
              <th style={{ minWidth: 160 }}>Event</th>
              <th style={{ minWidth: 220 }}>Athlete Names</th>
              <th style={{ minWidth: 90 }}>Boat</th>
              <th style={{ minWidth: 90 }}>Blades</th>
              <th style={{ minWidth: 220 }}>Notes</th>
              <th style={{ minWidth: 110 }}>Withdrawn</th>
              <th style={{ minWidth: 90 }}>Rejected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <select value={r.day} onChange={(e) => updateCell(r.id, { day: e.target.value })}>
                    {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td>
                  <input value={r.div} onChange={(e) => updateCell(r.id, { div: e.target.value })} />
                </td>
                <td>
                  <input value={r.event} onChange={(e) => updateCell(r.id, { event: e.target.value })} />
                </td>
                <td>
                  <input value={r.athleteNames} onChange={(e) => updateCell(r.id, { athleteNames: e.target.value })} />
                </td>
                <td>
                  <select value={r.boat} onChange={(e) => updateCell(r.id, { boat: e.target.value })}>
                    {boatOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </td>
                <td>
                  <select value={r.blades} onChange={(e) => updateCell(r.id, { blades: e.target.value })}>
                    {bladeOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </td>
                <td>
                  <input value={r.notes} onChange={(e) => updateCell(r.id, { notes: e.target.value })} />
                </td>
                <td>
                  <input type="checkbox" checked={r.withdrawn} onChange={(e) => updateCell(r.id, { withdrawn: e.target.checked })} />
                </td>
                <td>
                  <input type="checkbox" checked={r.rejected} onChange={(e) => updateCell(r.id, { rejected: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


