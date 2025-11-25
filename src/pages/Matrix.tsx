import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeEntries } from '../data/entries'
import { subscribeBoats, type Boat } from '../data/boats'
import type { Entry } from '../models/entry'
import { getRaceById } from '../data/races'
import type { Race } from '../models/race'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'

type TypeFilter = Record<string, boolean>

function typeGroupIndex(t: string): number {
  const type = (t || '').toLowerCase()
  if (type === '8+' || type === '8x+') return 0
  if (type === '4x/-' || type === '4-' || type === '4x') return 1
  if (type === '4+' || type === '4x+') return 2
  if (type === '2x/-' || type === '2-' || type === '2x') return 3
  if (type === '1x') return 4
  return 99
}

function getBaseName(name: string): string {
  return (name || '').trim().replace(/\s\((?:1\/2|2\/2)\)$/, '')
}

export function Matrix() {
  const { raceId } = useParams()
  const [race, setRace] = useState<Race | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [boatsRef, setBoatsRef] = useState<Boat[]>([])
  const [typeFilter, setTypeFilter] = useState<TypeFilter>({})
  const [colWidth, setColWidth] = useState<number>(200)

  useEffect(() => {
    if (!raceId) return
    return subscribeEntries(raceId, setEntries)
  }, [raceId])

  useEffect(() => {
    const unsub = subscribeBoats(setBoatsRef)
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!raceId) return
    ;(async () => setRace(await getRaceById(raceId)))()
  }, [raceId])

  // Build ordered boat list (all boats), type-then-name
  const boatsOrdered = useMemo(() => {
    const active = boatsRef.filter(b => (b.name || '').trim())
    const sorted = active.sort((a, b) => {
      const ga = typeGroupIndex(a.type || '')
      const gb = typeGroupIndex(b.type || '')
      if (ga !== gb) return ga - gb
      const an = getBaseName(a.name || '')
      const bn = getBaseName(b.name || '')
      return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' })
    })
    return sorted
  }, [boatsRef])

  // Derive columns: unique [day, div] present in entries, ordered by day then div
  const dayOrder = useMemo(() => {
    if (!race) return [] as string[]
    return enumerateDaysInclusive(race.startDate, race.endDate).map(formatDayLabel)
  }, [race])

  const columns = useMemo(() => {
    const seen = new Set<string>()
    const cols: { key: string; day: string; div: string; label: string }[] = []
    for (const r of entries) {
      if (!r.day || !r.div) continue
      const day = r.day
      const div = r.div
      const key = `${day}||${div}`
      if (seen.has(key)) continue
      seen.add(key)
      cols.push({ key, day, div, label: `${day} ${div}` })
    }
    cols.sort((a, b) => {
      const da = dayOrder.indexOf(a.day)
      const db = dayOrder.indexOf(b.day)
      if (da !== db) return da - db
      return a.div.localeCompare(b.div, undefined, { numeric: true, sensitivity: 'base' })
    })
    return cols
  }, [entries, dayOrder])

  // Responsive column width so all columns fit within viewport on smaller screens
  useEffect(() => {
    function compute() {
      const totalCols = (columns.length || 0) + 1 // +1 for boat name column
      if (totalCols <= 0) return
      const vw = window.innerWidth || 1024
      // Estimate paddings/margins: main (32), card (32), some gap (16)
      const gutters = 80
      const available = Math.max(320, vw - gutters)
      const per = Math.floor(available / totalCols)
      const next = Math.max(90, Math.min(200, per))
      setColWidth(next)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [columns.length])

  // Build usage set: base boat name x (day,div)
  const usage = useMemo(() => {
    const s = new Set<string>()
    for (const r of entries) {
      if (r.status !== 'entered') continue
      const boatBase = getBaseName(r.boat || '')
      if (!boatBase) continue
      s.add(`${boatBase}||${r.day}||${r.div}`)
    }
    return s
  }, [entries])

  // Type filters list and state init
  const typesOrdered = useMemo(() => {
    const set = new Set<string>()
    for (const b of boatsRef) {
      const t = (b.type || '').trim()
      if (t) set.add(t)
    }
    return Array.from(set).sort((a, b) => typeGroupIndex(a) - typeGroupIndex(b))
  }, [boatsRef])

  useEffect(() => {
    // Initialize filter to all true on first load or when types change
    setTypeFilter(prev => {
      const next: TypeFilter = {}
      for (const t of typesOrdered) next[t] = prev[t] ?? true
      return next
    })
  }, [typesOrdered])

  const toggleType = (t: string) => {
    setTypeFilter(prev => ({ ...prev, [t]: !prev[t] }))
  }

  const visibleBoats = useMemo(() => {
    return boatsOrdered.filter(b => typeFilter[b.type || ''])
  }, [boatsOrdered, typeFilter])

  return (
    <div className="matrix-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{race?.name ?? 'Matrix'}</h1>
          {race ? <div style={{ color: 'var(--muted)', fontSize: 14 }}>Boat usage by division</div> : null}
        </div>
        <div className="type-filters" style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {typesOrdered.map((t) => (
            <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={!!typeFilter[t]} onChange={() => toggleType(t)} />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <div className="matrix-table" style={{ gridTemplateColumns: `repeat(${columns.length + 1}, ${colWidth}px)` }}>
          <div className="matrix-header matrix-cell boat-col">Boat</div>
          {columns.map((c) => (
            <div key={c.key} className="matrix-header matrix-cell col-header">{c.label}</div>
          ))}
          {visibleBoats.map((b) => {
            const name = (b.name || '').trim()
            const base = getBaseName(name)
            return (
              <div key={name} className="matrix-row">
                <div className="matrix-cell boat-col" title={b.type}>{name}</div>
                {columns.map((c) => {
                  const k = `${base}||${c.day}||${c.div}`
                  const used = usage.has(k)
                  return (
                    <div key={c.key} className="matrix-cell usage-cell" data-used={used ? '1' : '0'}>
                      {used ? '✓' : ''}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


