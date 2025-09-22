import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeEntries } from '../data/entries'
import type { Entry } from '../models/entry'
import { getRaceById } from '../data/races'
import type { Race as RaceModel } from '../models/race'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'

export function Race() {
  const { raceId } = useParams()
  const [race, setRace] = useState<RaceModel | null>(null)
  const [all, setAll] = useState<Entry[]>([])
  const [dayFilter, setDayFilter] = useState('')
  const [divFilter, setDivFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')

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
    const ready = all.filter((e) => e.status === 'ready' || e.status === 'entered')
    const matches = ready.filter((e) => {
      if (dayFilter && e.day !== dayFilter) return false
      if (divFilter && e.div.toLowerCase() !== divFilter.toLowerCase()) return false
      if (eventFilter && !e.event.toLowerCase().includes(eventFilter.toLowerCase())) return false
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
  }, [all, dayFilter, divFilter, eventFilter, race])

  const dayOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of all) set.add(e.day)
    return Array.from(set)
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

      <div className="card" style={{ marginBottom: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Day</span>
            <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
              <option value="">All</option>
              {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Division</span>
            <input value={divFilter} onChange={(e) => setDivFilter(e.target.value)} placeholder="e.g. 1" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Event</span>
            <input value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} placeholder="e.g. J15 2x" />
          </label>
        </div>
      </div>

      <div className="entries-list">
        {entries.map((r) => (
          <div key={r.id} className="entry-row">
            <span className="badge mono">{r.day || '-'}</span>
            <span className="badge mono">Div {r.div || '-'}</span>
            <span className="entry-event">{r.event || '-'}</span>
            <span className="sep">•</span>
            <span>{r.athleteNames || '-'}</span>
            <span className="sep">•</span>
            <span>Boat: {r.boat || '-'}</span>
            <span>Blades: {r.blades || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


