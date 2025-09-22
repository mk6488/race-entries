import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Entry } from '../models/entry'
import { subscribeEntries } from '../data/entries'
import { getRaceById } from '../data/races'
import type { Race as RaceType } from '../models/race'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'

type SortKey = 'day' | 'div' | 'event' | 'athleteNames' | 'boat' | 'blades'

export function Race() {
  const { raceId } = useParams()
  const [race, setRace] = useState<RaceType | null>(null)
  const [rows, setRows] = useState<Entry[]>([])

  // Filters
  const [dayFilter, setDayFilter] = useState<string[]>([])
  const [divFilter, setDivFilter] = useState<string[]>([])
  const [eventFilter, setEventFilter] = useState<string[]>([])
  const [boatFilter, setBoatFilter] = useState<string[]>([])
  const [bladesFilter, setBladesFilter] = useState<string[]>([])

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('day')
  const [sortAsc, setSortAsc] = useState(true)

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

  // Unique value options for header filters
  const uniqueDivs = useMemo(() => Array.from(new Set(enteredRows.map(r => r.div).filter(Boolean))).sort(), [enteredRows])
  const uniqueEvents = useMemo(() => Array.from(new Set(enteredRows.map(r => r.event).filter(Boolean))).sort(), [enteredRows])
  const uniqueBoats = useMemo(() => Array.from(new Set(enteredRows.map(r => r.boat).filter(Boolean))).sort(), [enteredRows])
  const uniqueBlades = useMemo(() => Array.from(new Set(enteredRows.map(r => r.blades).filter(Boolean))).sort(), [enteredRows])

  const filtered = useMemo(() => {
    return enteredRows.filter((r) => {
      if (dayFilter.length && !dayFilter.includes(r.day)) return false
      if (divFilter.length && !divFilter.includes(r.div)) return false
      if (eventFilter.length && !eventFilter.includes(r.event)) return false
      if (boatFilter.length && !boatFilter.includes(r.boat)) return false
      if (bladesFilter.length && !bladesFilter.includes(r.blades)) return false
      return true
    })
  }, [enteredRows, dayFilter, divFilter, eventFilter, boatFilter, bladesFilter])

  const sorted = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
    const cmp = (a: Entry, b: Entry) => {
      const k: SortKey = sortKey
      const av = (a[k] ?? '').toString()
      const bv = (b[k] ?? '').toString()
      const d = collator.compare(av, bv)
      return sortAsc ? d : -d
    }
    return [...filtered].sort(cmp)
  }, [filtered, sortKey, sortAsc])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc((v) => !v)
    else {
      setSortKey(k)
      setSortAsc(true)
    }
  }

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

      {/* Filters are embedded in the table header below */}

      <div className="card" style={{ marginBottom: 8 }}>
        <div className="chips">
          {dayFilter.map((v) => (
            <span key={`day:${v}`} className="chip">Day: {v} <button onClick={() => setDayFilter(dayFilter.filter(x=>x!==v))}>✕</button></span>
          ))}
          {divFilter.map((v) => (
            <span key={`div:${v}`} className="chip">Div: {v} <button onClick={() => setDivFilter(divFilter.filter(x=>x!==v))}>✕</button></span>
          ))}
          {eventFilter.map((v) => (
            <span key={`event:${v}`} className="chip">Event: {v} <button onClick={() => setEventFilter(eventFilter.filter(x=>x!==v))}>✕</button></span>
          ))}
          {boatFilter.map((v) => (
            <span key={`boat:${v}`} className="chip">Boat: {v} <button onClick={() => setBoatFilter(boatFilter.filter(x=>x!==v))}>✕</button></span>
          ))}
          {bladesFilter.map((v) => (
            <span key={`blades:${v}`} className="chip">Blades: {v} <button onClick={() => setBladesFilter(bladesFilter.filter(x=>x!==v))}>✕</button></span>
          ))}
          {(dayFilter.length||divFilter.length||eventFilter.length||boatFilter.length||bladesFilter.length) ? (
            <button onClick={() => { setDayFilter([]); setDivFilter([]); setEventFilter([]); setBoatFilter([]); setBladesFilter([]) }} style={{ marginLeft: 'auto', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>Clear all</button>
          ) : null}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="sheet">
          <thead>
            <tr>
              <th onClick={() => toggleSort('day')} style={{ cursor: 'pointer', minWidth: 90 }}>Day {sortKey==='day' ? (sortAsc?'▲':'▼') : ''}</th>
              <th onClick={() => toggleSort('div')} style={{ cursor: 'pointer', minWidth: 70 }}>Div {sortKey==='div' ? (sortAsc?'▲':'▼') : ''}</th>
              <th onClick={() => toggleSort('event')} style={{ cursor: 'pointer', minWidth: 140 }}>Event {sortKey==='event' ? (sortAsc?'▲':'▼') : ''}</th>
              <th onClick={() => toggleSort('athleteNames')} style={{ cursor: 'pointer', minWidth: 320 }}>Athlete Names {sortKey==='athleteNames' ? (sortAsc?'▲':'▼') : ''}</th>
              <th onClick={() => toggleSort('boat')} style={{ cursor: 'pointer', minWidth: 160 }}>Boat {sortKey==='boat' ? (sortAsc?'▲':'▼') : ''}</th>
              <th onClick={() => toggleSort('blades')} style={{ cursor: 'pointer', minWidth: 120 }}>Blades {sortKey==='blades' ? (sortAsc?'▲':'▼') : ''}</th>
            </tr>
            <tr>
              <th>
                <select multiple value={dayFilter} onChange={(e) => setDayFilter(Array.from(e.currentTarget.selectedOptions).map(o=>o.value))}>
                  {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </th>
              <th>
                <select multiple value={divFilter} onChange={(e) => setDivFilter(Array.from(e.currentTarget.selectedOptions).map(o=>o.value))}>
                  {uniqueDivs.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </th>
              <th>
                <select multiple value={eventFilter} onChange={(e) => setEventFilter(Array.from(e.currentTarget.selectedOptions).map(o=>o.value))}>
                  {uniqueEvents.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              </th>
              <th/>
              <th>
                <select multiple value={boatFilter} onChange={(e) => setBoatFilter(Array.from(e.currentTarget.selectedOptions).map(o=>o.value))}>
                  {uniqueBoats.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </th>
              <th>
                <select multiple value={bladesFilter} onChange={(e) => setBladesFilter(Array.from(e.currentTarget.selectedOptions).map(o=>o.value))}>
                  {uniqueBlades.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
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


