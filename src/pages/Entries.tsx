import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeEntries, createEntry, updateEntry } from '../data/entries'
import { subscribeBlades, type Blade } from '../data/blades'
import { subscribeBoats, type Boat } from '../data/boats'
import { getRaceById } from '../data/races'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'
import type { Race } from '../models/race'
import type { Entry, NewEntry } from '../models/entry'

export function Entries() {
  const { raceId } = useParams()
  const [rows, setRows] = useState<Entry[]>([])
  const [race, setRace] = useState<Race | null>(null)
  const [dayOptions, setDayOptions] = useState<string[]>([])
  const [allBoats, setAllBoats] = useState<Boat[]>([])
  const [bladeOptions, setBladeOptions] = useState<Blade[]>([])

  useEffect(() => {
    if (!raceId) return
    const unsub = subscribeEntries(raceId, setRows)
    return () => unsub()
  }, [raceId])

  useEffect(() => {
    const unsub = subscribeBlades(setBladeOptions)
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeBoats(setAllBoats)
    return () => unsub()
  }, [])

  function inferBoatType(event: string): string | null {
    const e = event.toLowerCase()
    if (e.includes('8x+') || e.includes('8+')) return '8+'
    if (e.includes('4x+') || e.includes('4+')) return '4+'
    if (e.includes('4x') || e.includes('4x-') || e.includes('4-')) return '4x/-'
    if (e.includes('2x') || e.includes('2x-') || e.includes('2-')) return '2x/-'
    if (e.includes('1x') || e.includes('1x-')) return '1x'
    return null
  }

  useEffect(() => {
    if (!raceId) return
    ;(async () => {
      const r = await getRaceById(raceId)
      setRace(r)
      if (!r) { setDayOptions([]); return }
      const days = enumerateDaysInclusive(r.startDate, r.endDate)
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
      boat: '',
      blades: '',
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
        <div>
          <h1 style={{ margin: 0 }}>{race?.name ?? 'Selected race'}</h1>
          {race && (
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              {(() => {
                const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
                const start = race.startDate
                const end = race.endDate
                return end && end.getTime() !== start.getTime() ? `${fmt(start)} → ${fmt(end)}` : fmt(start)
              })()}
            </div>
          )}
        </div>
        <button onClick={addRow}>Add row</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="sheet">
          <thead>
            <tr>
              <th style={{ minWidth: 90 }}>Day</th>
              <th style={{ minWidth: 70 }}>Div</th>
              <th style={{ minWidth: 70 }}>Event</th>
              <th style={{ minWidth: 420 }}>Athlete Names</th>
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
                  <input
                    value={r.event}
                    onChange={(e) => {
                      const next = e.target.value
                      const eventText = next.trim()
                      const type = inferBoatType(eventText)
                      const options = type && eventText
                        ? allBoats.filter((b) => b.type === type).sort((a,b) => a.name.localeCompare(b.name))
                        : []
                      const boatIsValid = options.some((b) => b.name === r.boat)
                      const patch: Partial<NewEntry> = { event: next }
                      if (!boatIsValid) patch.boat = ''
                      updateCell(r.id, patch)
                    }}
                  />
                </td>
                <td>
                  <input value={r.athleteNames} onChange={(e) => updateCell(r.id, { athleteNames: e.target.value })} />
                </td>
                <td>
                  {(() => {
                    const eventText = r.event?.trim() ?? ''
                    const type = inferBoatType(eventText)
                    const options = type && eventText
                      ? allBoats.filter((b) => b.type === type).sort((a,b) => a.name.localeCompare(b.name))
                      : []
                    return (
                      <select value={r.boat} onChange={(e) => updateCell(r.id, { boat: e.target.value })}>
                        <option value="">-</option>
                        {options.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                    )
                  })()}
                </td>
                <td>
                  <select value={r.blades} onChange={(e) => updateCell(r.id, { blades: e.target.value })}>
                    <option value="">-</option>
                    {bladeOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
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


