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
  const [dayFilter, setDayFilter] = useState('')
  const [divFilter, setDivFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [boatFilter, setBoatFilter] = useState('')
  const [bladesFilter, setBladesFilter] = useState('')

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
      if (dayFilter && r.day !== dayFilter) return false
      if (divFilter && r.div.toLowerCase() !== divFilter.toLowerCase()) return false
      if (eventFilter && r.event !== eventFilter) return false
      if (boatFilter && r.boat !== boatFilter) return false
      if (bladesFilter && r.blades !== bladesFilter) return false
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
                <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
                  <option value="">All</option>
                  {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </th>
              <th>
                <select value={divFilter} onChange={(e) => setDivFilter(e.target.value)}>
                  <option value="">All</option>
                  {uniqueDivs.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </th>
              <th>
                <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
                  <option value="">All</option>
                  {uniqueEvents.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              </th>
              <th/>
              <th>
                <select value={boatFilter} onChange={(e) => setBoatFilter(e.target.value)}>
                  <option value="">All</option>
                  {uniqueBoats.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </th>
              <th>
                <select value={bladesFilter} onChange={(e) => setBladesFilter(e.target.value)}>
                  <option value="">All</option>
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


