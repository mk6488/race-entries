import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeEntries, updateEntry } from '../data/entries'
import type { Entry } from '../models/entry'
import { getRaceById } from '../data/races'
import type { Race as RaceModel } from '../models/race'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'
import { Modal } from '../ui/Modal'

export function Race() {
  const { raceId } = useParams()
  const [race, setRace] = useState<RaceModel | null>(null)
  const [all, setAll] = useState<Entry[]>([])
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [selectedDivs, setSelectedDivs] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftNumber, setDraftNumber] = useState('')
  const [draftTimes, setDraftTimes] = useState<string[]>([])
  const [timeInput, setTimeInput] = useState('')

  useEffect(() => {
    if (!raceId) return
    const unsub = subscribeEntries(raceId, setAll)
    return () => unsub()
  }, [raceId])

  useEffect(() => {
    if (!raceId) return
    ;(async () => {
      const r = await getRaceById(raceId)
      setRace(r)
    })()
  }, [raceId])

  const entries = useMemo(() => {
    const ready = all.filter((e) => e.status === 'entered')
    const matches = ready.filter((e) => {
      if (selectedDays.length > 0 && !selectedDays.includes(e.day)) return false
      if (selectedDivs.length > 0 && !selectedDivs.map((d) => d.toLowerCase()).includes(e.div.toLowerCase())) return false
      return true
    })
    const dayRank: Record<string, number> = {}
    const dayOrder = race ? enumerateDaysInclusive(race.startDate, race.endDate).map(formatDayLabel) : []
    dayOrder.forEach((d, i) => { dayRank[d] = i })
    const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : null }
    return [...matches].sort((a, b) => {
      const ar = dayRank[a.day] ?? 9999
      const br = dayRank[b.day] ?? 9999
      if (ar !== br) return ar - br
      const adn = num(a.div); const bdn = num(b.div)
      if (adn !== null && bdn !== null && adn !== bdn) return adn - bdn
      const divCmp = a.div.localeCompare(b.div, undefined, { sensitivity: 'base', numeric: true })
      if (divCmp !== 0) return divCmp
      return a.event.localeCompare(b.event, undefined, { sensitivity: 'base', numeric: true })
    })
  }, [all, selectedDays, selectedDivs, race])

  const dayOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of all) set.add(e.day)
    return Array.from(set)
  }, [all])

  const divOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of all) set.add((e.div || '').toString())
    return Array.from(set).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }, [all])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{race?.name ?? 'Race'}</h1>
          {race && (
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              {(() => {
                const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
                const s = race.startDate; const e = race.endDate
                return e && e.getTime() !== s.getTime() ? `${fmt(s)} → ${fmt(e)}` : fmt(s)
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <span className="muted">Day:</span>
        {dayOptions.map((d) => (
          <button key={d} type="button" className={`chip selectable ${selectedDays.includes(d) ? 'selected' : ''}`} onClick={() => setSelectedDays(selectedDays.includes(d) ? selectedDays.filter(x=>x!==d) : [...selectedDays, d])}>{d}</button>
        ))}
        <span className="sep">|</span>
        <span className="muted">Div:</span>
        {divOptions.map((d) => (
          <button key={d} type="button" className={`chip selectable ${selectedDivs.includes(d) ? 'selected' : ''}`} onClick={() => setSelectedDivs(selectedDivs.includes(d) ? selectedDivs.filter(x=>x!==d) : [...selectedDivs, d])}>{d}</button>
        ))}
        <span style={{ marginLeft: 'auto' }} />
        <button className="link-btn" type="button" onClick={() => { setSelectedDays([]); setSelectedDivs([]) }}>Clear</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="sheet">
          <thead>
            <tr>
              <th style={{ minWidth: 90 }}>Day</th>
              <th style={{ minWidth: 70 }}>Div</th>
              <th style={{ minWidth: 120 }}>Event</th>
              <th style={{ minWidth: 320 }}>Athlete Names</th>
              <th style={{ minWidth: 120 }}>Boat</th>
              <th style={{ minWidth: 90 }}>Blades</th>
              <th style={{ minWidth: 90 }}>Race No.</th>
              <th style={{ minWidth: 140 }}>Time(s)</th>
              <th style={{ minWidth: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((r) => (
              <tr key={r.id}>
                <td>{r.day || '-'}</td>
                <td>{r.div || '-'}</td>
                <td>{r.event || '-'}</td>
                <td>{r.athleteNames || '-'}</td>
                <td>{r.boat || '-'}</td>
                <td>{r.blades || '-'}</td>
                <td>{r.raceNumber || '-'}</td>
                <td>{(r.raceTimes && r.raceTimes.length) ? r.raceTimes.join(', ') : '-'}</td>
                <td>
                  <button type="button" onClick={() => {
                    setEditingId(r.id)
                    setDraftNumber(r.raceNumber || '')
                    setDraftTimes(Array.isArray(r.raceTimes) ? r.raceTimes : [])
                    setTimeInput('')
                  }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editingId}
        onClose={() => { setEditingId(null); setTimeInput('') }}
        title="Edit race details"
        footer={null}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!editingId) return
            await updateEntry(editingId, { raceNumber: draftNumber, raceTimes: draftTimes })
            setEditingId(null)
            setTimeInput('')
          }}
          className="form-grid"
        >
          <div className="form-row">
            <label>Race number</label>
            <input value={draftNumber} onChange={(e) => setDraftNumber(e.target.value)} placeholder="e.g. 57" />
          </div>
          <div className="form-row form-span-2">
            <label>Time(s) (HH:MM)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {draftTimes.map((t, i) => (
                <span key={t+String(i)} className="chip">
                  {t}
                  <button type="button" className="icon-btn" onClick={() => setDraftTimes(draftTimes.filter((_, idx) => idx !== i))}>✕</button>
                </span>
              ))}
              <input
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="HH:MM"
                style={{ width: 100 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const val = timeInput.trim()
                    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(val)) {
                      if (!draftTimes.includes(val)) setDraftTimes([...draftTimes, val])
                      setTimeInput('')
                    }
                  }
                }}
              />
              <button type="button" onClick={() => {
                const val = timeInput.trim()
                if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(val)) {
                  if (!draftTimes.includes(val)) setDraftTimes([...draftTimes, val])
                  setTimeInput('')
                }
              }}>Add</button>
            </div>
            <span className="muted">Press Enter to add. Click × to remove.</span>
          </div>
          <div className="form-span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => { setEditingId(null); setTimeInput('') }} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>Cancel</button>
            <button type="submit">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}


