import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeEntries } from '../data/entries'
import { subscribeBoats, type Boat } from '../data/boats'
import type { Entry } from '../models/entry'
import { getRaceById } from '../data/races'
import type { Race } from '../models/race'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'

export function Equipment() {
  const { raceId } = useParams()
  const [race, setRace] = useState<Race | null>(null)
  const [rows, setRows] = useState<Entry[]>([])
  const [boatsRef, setBoatsRef] = useState<Boat[]>([])
  const [loadedBoats, setLoadedBoats] = useState<Record<string, boolean>>({})
  const [loadedBlades, setLoadedBlades] = useState<Record<string, boolean>>({})
  const [bladeAmounts, setBladeAmounts] = useState<Record<string, number>>({})
  const dayOptions = useMemo(() => {
    if (!race) return [] as string[]
    return enumerateDaysInclusive(race.startDate, race.endDate).map(formatDayLabel)
  }, [race])

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

  useEffect(() => {
    const unsub = subscribeBoats(setBoatsRef)
    return () => unsub()
  }, [])

  // Persist loaded-state in localStorage per race
  useEffect(() => {
    if (!raceId) return
    try {
      const b = localStorage.getItem(`equip:${raceId}:boats`)
      const l = b ? JSON.parse(b) : {}
      setLoadedBoats(l && typeof l === 'object' ? l : {})
    } catch {}
    try {
      const b = localStorage.getItem(`equip:${raceId}:blades`)
      const l = b ? JSON.parse(b) : {}
      setLoadedBlades(l && typeof l === 'object' ? l : {})
    } catch {}
    try {
      const b = localStorage.getItem(`equip:${raceId}:bladeAmounts`)
      const l = b ? JSON.parse(b) : {}
      setBladeAmounts(l && typeof l === 'object' ? l : {})
    } catch {}
  }, [raceId])

  useEffect(() => {
    if (!raceId) return
    try { localStorage.setItem(`equip:${raceId}:boats`, JSON.stringify(loadedBoats)) } catch {}
  }, [loadedBoats, raceId])
  useEffect(() => {
    if (!raceId) return
    try { localStorage.setItem(`equip:${raceId}:blades`, JSON.stringify(loadedBlades)) } catch {}
  }, [loadedBlades, raceId])
  useEffect(() => {
    if (!raceId) return
    try { localStorage.setItem(`equip:${raceId}:bladeAmounts`, JSON.stringify(bladeAmounts)) } catch {}
  }, [bladeAmounts, raceId])

  const enteredRows = useMemo(() => rows.filter(r => r.status === 'entered'), [rows])

  function countBoats(list: Entry[]) {
    const m = new Map<string, number>()
    let missing = 0
    for (const r of list) {
      const name = (r.boat || '').trim()
      if (!name) { missing += 1; continue }
      m.set(name, (m.get(name) || 0) + 1)
    }
    return { map: m, missing }
  }

  function countBlades(list: Entry[]) {
    const m = new Map<string, number>()
    let missing = 0
    for (const r of list) {
      const raw = (r.blades || '').trim()
      if (!raw) { missing += 1; continue }
      const parts = raw.includes('+') ? raw.split('+').map(s => s.trim()).filter(Boolean) : [raw]
      if (parts.length === 0) { missing += 1; continue }
      for (const p of parts) m.set(p, (m.get(p) || 0) + 1)
    }
    return { map: m, missing }
  }

  const overall = useMemo(() => {
    const boats = countBoats(enteredRows)
    const blades = countBlades(enteredRows)
    return { boats, blades }
  }, [enteredRows])

  const byDay = useMemo(() => {
    const out = new Map<string, { boats: ReturnType<typeof countBoats>; blades: ReturnType<typeof countBlades> }>()
    for (const d of dayOptions) {
      const list = enteredRows.filter(r => r.day === d)
      out.set(d, { boats: countBoats(list), blades: countBlades(list) })
    }
    return out
  }, [enteredRows, dayOptions])

  function mapToSortedArray(m: Map<string, number>) {
    return Array.from(m.entries()).sort((a,b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
  }

  // Boat sorting by type groups with gaps
  const boatNameToType = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of boatsRef) map.set((b.name || '').trim(), (b.type || '').trim())
    return map
  }, [boatsRef])

  function typeGroupIndex(t: string): number {
    const type = (t || '').toLowerCase()
    // Explicit grouping:
    // 0: 8x+/8+
    if (type === '8+' || type === '8x+') return 0
    // 1: 4x/4- (coxless)
    if (type === '4x/-' || type === '4-' || type === '4x') return 1
    // 2: 4x+/4+ (coxed)
    if (type === '4+' || type === '4x+') return 2
    // 3: 2x/2-
    if (type === '2x/-' || type === '2-' || type === '2x') return 3
    // 4: 1x
    if (type === '1x') return 4
    return 99
  }

  function sortBoatsWithGroups(m: Map<string, number>) {
    const items = Array.from(m.entries()) // [name, count]
    items.sort((a, b) => {
      const ta = boatNameToType.get(a[0]) || ''
      const tb = boatNameToType.get(b[0]) || ''
      const ga = typeGroupIndex(ta)
      const gb = typeGroupIndex(tb)
      if (ga !== gb) return ga - gb
      return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })
    })
    // Break into groups for separators
    const groups: Array<Array<[string, number]>> = [[], [], [], [], []]
    for (const it of items) {
      const g = typeGroupIndex(boatNameToType.get(it[0]) || '')
      const idx = Math.min(g, groups.length - 1)
      groups[idx].push(it)
    }
    const out: Array<{ kind: 'row'; name: string; count: number } | { kind: 'sep' }> = []
    groups.forEach((g, i) => {
      if (g.length === 0) return
      if (out.length > 0) out.push({ kind: 'sep' })
      g.forEach(([name, count]) => out.push({ kind: 'row', name, count }))
    })
    return out
  }

  // Prepare boat groups as separate lists (unique names)
  const boatGroups = useMemo(() => {
    const names = Array.from(overall.boats.map.keys())
    const groups: Array<string[]> = [[], [], [], [], []]
    for (const name of names) {
      const t = boatNameToType.get(name) || ''
      const gi = typeGroupIndex(t)
      if (gi < 5) groups[gi].push(name)
    }
    groups.forEach((g) => g.sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })))
    return groups
  }, [overall.boats.map, boatNameToType])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{race?.name ?? 'Equipment'}</h1>
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
      </div>

      <div className="equipment-grid">
        {/* Left: Boats */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Boats: 8+/8x+</div>
            <div className="table-scroll">
              <table className="sheet">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Boat</th>
                    <th style={{ width: 120 }}>Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {boatGroups[0].map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <input type="checkbox" checked={!!loadedBoats[name]} onChange={(e)=> setLoadedBoats(prev => ({ ...prev, [name]: e.target.checked }))} />
                      </td>
                    </tr>
                  ))}
                  {boatGroups[0].length === 0 ? <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>None</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Boats: 4x/4- (coxless)</div>
            <div className="table-scroll">
              <table className="sheet">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Boat</th>
                    <th style={{ width: 120 }}>Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {boatGroups[1].map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <input type="checkbox" checked={!!loadedBoats[name]} onChange={(e)=> setLoadedBoats(prev => ({ ...prev, [name]: e.target.checked }))} />
                      </td>
                    </tr>
                  ))}
                  {boatGroups[1].length === 0 ? <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>None</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Boats: 4x+/4+ (coxed)</div>
            <div className="table-scroll">
              <table className="sheet">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Boat</th>
                    <th style={{ width: 120 }}>Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {boatGroups[2].map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <input type="checkbox" checked={!!loadedBoats[name]} onChange={(e)=> setLoadedBoats(prev => ({ ...prev, [name]: e.target.checked }))} />
                      </td>
                    </tr>
                  ))}
                  {boatGroups[2].length === 0 ? <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>None</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Boats: 2x/2-</div>
            <div className="table-scroll">
              <table className="sheet">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Boat</th>
                    <th style={{ width: 120 }}>Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {boatGroups[3].map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <input type="checkbox" checked={!!loadedBoats[name]} onChange={(e)=> setLoadedBoats(prev => ({ ...prev, [name]: e.target.checked }))} />
                      </td>
                    </tr>
                  ))}
                  {boatGroups[3].length === 0 ? <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>None</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Boats: 1x</div>
            <div className="table-scroll">
              <table className="sheet">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Boat</th>
                    <th style={{ width: 120 }}>Loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {boatGroups[4].map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <input type="checkbox" checked={!!loadedBoats[name]} onChange={(e)=> setLoadedBoats(prev => ({ ...prev, [name]: e.target.checked }))} />
                      </td>
                    </tr>
                  ))}
                  {boatGroups[4].length === 0 ? <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>None</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Middle: Blades */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Blades</div>
          <div className="table-scroll">
            <table className="sheet">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Set</th>
                  <th style={{ width: 120 }}>Amount</th>
                  <th style={{ width: 120 }}>Loaded</th>
                </tr>
              </thead>
              <tbody>
                {mapToSortedArray(overall.blades.map).map(([name, counted]) => {
                  const amount = (name in bladeAmounts) ? bladeAmounts[name] : (counted || 0)
                  return (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={amount}
                          onChange={(e)=> {
                            const v = parseInt(e.target.value || '0', 10)
                            setBladeAmounts(prev => ({ ...prev, [name]: Number.isFinite(v) ? v : 0 }))
                          }}
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <input type="checkbox" checked={!!loadedBlades[name]} onChange={(e)=> setLoadedBlades(prev => ({ ...prev, [name]: e.target.checked }))} />
                      </td>
                    </tr>
                  )
                })}
                {overall.blades.map.size === 0 ? (
                  <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No blades assigned yet</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Other equipment */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Other equipment</div>
          <div style={{ color: 'var(--muted)' }}>TBC</div>
        </div>
      </div>
    </div>
  )
}


