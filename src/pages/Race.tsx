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
  const [search, setSearch] = useState('')
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

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return enteredRows.filter((r) => {
      if (dayFilter && r.day !== dayFilter) return false
      if (divFilter && r.div.toLowerCase() !== divFilter.toLowerCase()) return false
      if (boatFilter && r.boat !== boatFilter) return false
      if (bladesFilter && r.blades !== bladesFilter) return false
      if (!s) return true
      return (
        r.event.toLowerCase().includes(s) ||
        r.athleteNames.toLowerCase().includes(s) ||
        r.boat.toLowerCase().includes(s)
      )
    })
  }, [enteredRows, dayFilter, divFilter, boatFilter, bladesFilter, search])

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

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
            <option value="">All days</option>
            {dayOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input placeholder="Div" value={divFilter} onChange={(e) => setDivFilter(e.target.value)} style={{ width: 90 }} />
          <input placeholder="Search event, crew, boat" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240, flex: 1 }} />
          <input placeholder="Boat" value={boatFilter} onChange={(e) => setBoatFilter(e.target.value)} style={{ width: 160 }} />
          <input placeholder="Blades" value={bladesFilter} onChange={(e) => setBladesFilter(e.target.value)} style={{ width: 120 }} />
          <button onClick={() => { setDayFilter(''); setDivFilter(''); setSearch(''); setBoatFilter(''); setBladesFilter('') }} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>Clear</button>
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


