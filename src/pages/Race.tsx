import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Entry } from '../models/entry'
import { subscribeEntries } from '../data/entries'
import { getRaceById } from '../data/races'
import type { Race as RaceType } from '../models/race'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'

export function Race() {
  const { raceId } = useParams()
  const [race, setRace] = useState<RaceType | null>(null)
  const [rows, setRows] = useState<Entry[]>([])
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter modal state via URL (?filter=1)
  const filterOpen = searchParams.get('filter') === '1'
  const closeFilter = () => { searchParams.delete('filter'); setSearchParams(searchParams, { replace: true }) }

  // Filter selections
  const [daySel, setDaySel] = useState<string[]>([])
  const [divSel, setDivSel] = useState<string[]>([])
  const [eventSel, setEventSel] = useState<string[]>([])

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

  const uniqueDivs = useMemo(() => Array.from(new Set(enteredRows.map(r => r.div).filter(Boolean))).sort(), [enteredRows])
  const uniqueEvents = useMemo(() => Array.from(new Set(enteredRows.map(r => r.event).filter(Boolean))).sort(), [enteredRows])

  const plainRows = useMemo(() => {
    return enteredRows.filter((r) => {
      if (daySel.length && !daySel.includes(r.day)) return false
      if (divSel.length && !divSel.includes(r.div)) return false
      if (eventSel.length && !eventSel.includes(r.event)) return false
      return true
    })
  }, [enteredRows, daySel, divSel, eventSel])

  // Auto sort by day (based on race day order), then div, then event
  const sortedRows = useMemo(() => {
    const dayOrder = new Map<string, number>(dayOptions.map((d, i) => [d, i]))
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
    return [...plainRows].sort((a, b) => {
      const ai = dayOrder.has(a.day) ? (dayOrder.get(a.day) as number) : 9999
      const bi = dayOrder.has(b.day) ? (dayOrder.get(b.day) as number) : 9999
      if (ai !== bi) return ai - bi
      const d = collator.compare(a.div || '', b.div || '')
      if (d !== 0) return d
      return collator.compare(a.event || '', b.event || '')
    })
  }, [plainRows, dayOptions])

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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="secondary-btn" onClick={() => { const p = new URLSearchParams(searchParams); p.set('filter','1'); setSearchParams(p, { replace: true }) }}>Filter</button>
      </div>

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
            {sortedRows.map((r) => (
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

      {filterOpen && (
        <div className="modal-overlay" onClick={closeFilter}>
          <div className="modal-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Filter entries</div>
              <button className="icon-btn" onClick={closeFilter} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-row">
                  <div className="section-title">Day</div>
                  <div>
                    {dayOptions.map((d) => (
                      <label key={d} className="row" style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                        <input type="checkbox" checked={daySel.includes(d)} onChange={(e)=> setDaySel(e.target.checked ? [...daySel,d] : daySel.filter(x=>x!==d))} />{d}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <div className="section-title">Div</div>
                  <div>
                    {uniqueDivs.map((v) => (
                      <label key={v} className="row" style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                        <input type="checkbox" checked={divSel.includes(v)} onChange={(e)=> setDivSel(e.target.checked ? [...divSel,v] : divSel.filter(x=>x!==v))} />{v}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <div className="section-title">Event</div>
                  <div>
                    {uniqueEvents.map((v) => (
                      <label key={v} className="row" style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                        <input type="checkbox" checked={eventSel.includes(v)} onChange={(e)=> setEventSel(e.target.checked ? [...eventSel,v] : eventSel.filter(x=>x!==v))} />{v}
                      </label>
                    ))}
                  </div>
                </div>
                
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-link" onClick={() => { setDaySel([]); setDivSel([]); setEventSel([]) }}>Clear</button>
              <button className="primary-btn" onClick={closeFilter}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


