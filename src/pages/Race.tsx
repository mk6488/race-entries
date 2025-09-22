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
  const [openFilter, setOpenFilter] = useState<null | 'day' | 'div' | 'event' | 'boat' | 'blades'>(null)

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
        <div style={{ position: 'relative', zIndex: 0 }}>
        <table className="sheet" style={{ position: 'relative', zIndex: 0 }}>
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
              <th className="filter-cell">
                <button className={`filter-btn ${openFilter==='day'?'active':''}`} onClick={() => setOpenFilter(openFilter==='day'?null:'day')}>Filter…</button>
                {openFilter==='day' && (
                  <div className="filter-popover" onMouseLeave={() => setOpenFilter(null)}>
                    <h4>Day</h4>
                    {dayOptions.map((d) => (
                      <label key={d} className="row"><input type="checkbox" checked={dayFilter.includes(d)} onChange={(e)=> setDayFilter(e.target.checked ? [...dayFilter,d] : dayFilter.filter(x=>x!==d))} />{d}</label>
                    ))}
                    <div className="filter-actions">
                      <button className="btn-link" onClick={() => setDayFilter([])}>Clear</button>
                      <button className="btn-link" onClick={() => setOpenFilter(null)}>Close</button>
                    </div>
                  </div>
                )}
              </th>
              <th className="filter-cell">
                <button className={`filter-btn ${openFilter==='div'?'active':''}`} onClick={() => setOpenFilter(openFilter==='div'?null:'div')}>Filter…</button>
                {openFilter==='div' && (
                  <div className="filter-popover" onMouseLeave={() => setOpenFilter(null)}>
                    <h4>Div</h4>
                    {uniqueDivs.map((d) => (
                      <label key={d} className="row"><input type="checkbox" checked={divFilter.includes(d)} onChange={(e)=> setDivFilter(e.target.checked ? [...divFilter,d] : divFilter.filter(x=>x!==d))} />{d}</label>
                    ))}
                    <div className="filter-actions">
                      <button className="btn-link" onClick={() => setDivFilter([])}>Clear</button>
                      <button className="btn-link" onClick={() => setOpenFilter(null)}>Close</button>
                    </div>
                  </div>
                )}
              </th>
              <th className="filter-cell">
                <button className={`filter-btn ${openFilter==='event'?'active':''}`} onClick={() => setOpenFilter(openFilter==='event'?null:'event')}>Filter…</button>
                {openFilter==='event' && (
                  <div className="filter-popover" onMouseLeave={() => setOpenFilter(null)}>
                    <h4>Event</h4>
                    {uniqueEvents.map((ev) => (
                      <label key={ev} className="row"><input type="checkbox" checked={eventFilter.includes(ev)} onChange={(e)=> setEventFilter(e.target.checked ? [...eventFilter,ev] : eventFilter.filter(x=>x!==ev))} />{ev}</label>
                    ))}
                    <div className="filter-actions">
                      <button className="btn-link" onClick={() => setEventFilter([])}>Clear</button>
                      <button className="btn-link" onClick={() => setOpenFilter(null)}>Close</button>
                    </div>
                  </div>
                )}
              </th>
              <th/>
              <th className="filter-cell">
                <button className={`filter-btn ${openFilter==='boat'?'active':''}`} onClick={() => setOpenFilter(openFilter==='boat'?null:'boat')}>Filter…</button>
                {openFilter==='boat' && (
                  <div className="filter-popover" onMouseLeave={() => setOpenFilter(null)}>
                    <h4>Boat</h4>
                    {uniqueBoats.map((b) => (
                      <label key={b} className="row"><input type="checkbox" checked={boatFilter.includes(b)} onChange={(e)=> setBoatFilter(e.target.checked ? [...boatFilter,b] : boatFilter.filter(x=>x!==b))} />{b}</label>
                    ))}
                    <div className="filter-actions">
                      <button className="btn-link" onClick={() => setBoatFilter([])}>Clear</button>
                      <button className="btn-link" onClick={() => setOpenFilter(null)}>Close</button>
                    </div>
                  </div>
                )}
              </th>
              <th className="filter-cell">
                <button className={`filter-btn ${openFilter==='blades'?'active':''}`} onClick={() => setOpenFilter(openFilter==='blades'?null:'blades')}>Filter…</button>
                {openFilter==='blades' && (
                  <div className="filter-popover" onMouseLeave={() => setOpenFilter(null)}>
                    <h4>Blades</h4>
                    {uniqueBlades.map((b) => (
                      <label key={b} className="row"><input type="checkbox" checked={bladesFilter.includes(b)} onChange={(e)=> setBladesFilter(e.target.checked ? [...bladesFilter,b] : bladesFilter.filter(x=>x!==b))} />{b}</label>
                    ))}
                    <div className="filter-actions">
                      <button className="btn-link" onClick={() => setBladesFilter([])}>Clear</button>
                      <button className="btn-link" onClick={() => setOpenFilter(null)}>Close</button>
                    </div>
                  </div>
                )}
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
    </div>
  )
}


