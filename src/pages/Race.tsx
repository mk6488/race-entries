import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Entry } from '../models/entry'
import { subscribeEntries } from '../data/entries'
import { getRaceById, updateRace } from '../data/races'
import type { Race as RaceType } from '../models/race'
import { updateEntry } from '../data/entries'
import { formatRaceTime, parseRaceTimeToMs } from '../utils/dates'
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

  const [editing, setEditing] = useState<Entry | null>(null)
  const [crewInput, setCrewInput] = useState('')
  const [times, setTimes] = useState<{ round: string; time: string }[]>([])
  const drawReleased = !!race?.drawReleased
  const [savingDraw, setSavingDraw] = useState(false)

  function openTimes(e: Entry) {
    setEditing(e)
    setCrewInput(e.crewNumber != null ? String(e.crewNumber) : '')
    const initial = (e.raceTimes || []).map(t => ({ round: t.round || '', time: formatRaceTime(t.timeMs) }))
    setTimes(initial.length ? initial : [{ round: 'Heat', time: '' }])
  }

  function addTimeRow() {
    setTimes(prev => [...prev, { round: 'Final', time: '' }])
  }

  function removeTimeRow(idx: number) {
    setTimes(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveTimes() {
    if (!editing) return
    const crewNumber = crewInput.trim() ? parseInt(crewInput, 10) : null
    if (crewInput.trim() && (!Number.isFinite(crewNumber) || crewNumber! < 0)) return
    const raceTimes = times
      .map(t => ({ round: t.round.trim(), timeMs: parseRaceTimeToMs(t.time) }))
      .filter(t => t.round && t.timeMs != null) as { round: string; timeMs: number }[]
    await updateEntry(editing.id, { crewNumber: crewNumber ?? null, raceTimes })
    setEditing(null)
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button className="secondary-btn" onClick={() => { const p = new URLSearchParams(searchParams); p.set('filter','1'); setSearchParams(p, { replace: true }) }}>Filter</button>
        <button
          className="row-action"
          disabled={!raceId || savingDraw}
          onClick={async () => {
            if (!raceId) return
            try {
              setSavingDraw(true)
              await updateRace(raceId, { drawReleased: !drawReleased })
              setRace(r => r ? { ...r, drawReleased: !drawReleased } : r)
            } finally {
              setSavingDraw(false)
            }
          }}
          title={drawReleased ? 'Disable times editing' : 'Enable times editing'}
        >
          {drawReleased ? 'Draw released ✓' : 'Release draw'}
        </button>
      </div>

      <div className="table-scroll">
        <table className="sheet">
          <thead>
            <tr>
              <th style={{ minWidth: 90 }}>Day</th>
              <th style={{ minWidth: 70 }}>Div</th>
              <th style={{ minWidth: 140 }}>Event</th>
              <th style={{ minWidth: 320 }}>Athlete Names</th>
              <th style={{ minWidth: 160 }}>Boat</th>
              <th style={{ minWidth: 120 }}>Blades</th>
              <th style={{ minWidth: 100 }}>Crew #</th>
              <th style={{ minWidth: 160 }}>Times</th>
              <th style={{ width: 1 }} />
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
                <td>{r.crewNumber ?? ''}</td>
                <td>{(r.raceTimes||[]).map((t,i)=> <span key={i} className="badge mono" style={{ marginRight: 6 }}>{t.round}:{' '}{formatRaceTime(t.timeMs)}</span>)}</td>
                <td>
                  <button className="row-action" onClick={() => openTimes(r)} disabled={!drawReleased}>Times</button>
                </td>
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

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit crew number & race times</div>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-row">
                  <label className="section-title">Crew number</label>
                  <input type="number" min={0} placeholder="e.g. 152" value={crewInput} onChange={(e)=> setCrewInput(e.target.value)} />
                </div>

                <div className="form-row form-span-2">
                  <div className="section-title">Race times</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {times.map((t, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                        <input type="text" placeholder="Round (Heat / Semi / Final)" value={t.round} onChange={(e)=> setTimes(prev => prev.map((x,i)=> i===idx? { ...x, round: e.target.value }: x))} />
                        <input type="text" placeholder="mm:ss(.SS)" value={t.time} onChange={(e)=> setTimes(prev => prev.map((x,i)=> i===idx? { ...x, time: e.target.value }: x))} />
                        <button type="button" className="row-action" onClick={() => removeTimeRow(idx)}>Remove</button>
                      </div>
                    ))}
                    <div>
                      <button type="button" className="row-action" onClick={addTimeRow}>Add time</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-link" onClick={() => setEditing(null)}>Cancel</button>
              <button className="primary-btn" onClick={saveTimes}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


