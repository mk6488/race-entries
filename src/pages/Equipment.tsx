import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { subscribeEntries } from '../data/entries'
import { subscribeBoats, type Boat } from '../data/boats'
import { subscribeBlades, type Blade } from '../data/blades'
import { subscribeDivisionGroups, type DivisionGroup } from '../data/divisionGroups'
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
  const [bladesRef, setBladesRef] = useState<Blade[]>([])
  const [groups, setGroups] = useState<DivisionGroup[]>([])
  const otherSections = useMemo(() => [
    { title: 'Safety', items: ['First Aid Pouch', 'Lifejacket', 'Throw Lines'] },
    { title: 'Coxing', items: ['Cox boxes', 'Cox box chargers'] },
    { title: 'Coaching / Boat handling', items: ['Stroke coaches', 'Trestles'] },
    { title: 'Essentials', items: ['Toolbag and spares', 'Sani Bag'] },
    { title: 'Site setup', items: ['Gazebo', 'Tables', 'Chairs', 'Kitchen'] },
  ], [])
  const [loadedOther, setLoadedOther] = useState<Record<string, boolean>>({})
  const [otherAmounts, setOtherAmounts] = useState<Record<string, string>>({})
  const otherDefaultAmounts = useMemo(() => ({
    'First Aid Pouch': '1',
    'Toolbag and spares': '1',
    'Sani Bag': '1',
  } as Record<string, string>), [])
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

  // Subscribe to blades reference (with amounts)
  useEffect(() => {
    const unsub = subscribeBlades(setBladesRef)
    return () => unsub()
  }, [])

  // Subscribe to division groups (to group simultaneous divisions)
  useEffect(() => {
    if (!raceId) return
    return subscribeDivisionGroups(raceId, setGroups)
  }, [raceId])

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
      const b = localStorage.getItem(`equip:${raceId}:other`)
      const l = b ? JSON.parse(b) : {}
      setLoadedOther(l && typeof l === 'object' ? l : {})
    } catch {}
    try {
      const b = localStorage.getItem(`equip:${raceId}:otherAmounts`)
      const l = b ? JSON.parse(b) : {}
      setOtherAmounts(l && typeof l === 'object' ? l : {})
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
    try { localStorage.setItem(`equip:${raceId}:other`, JSON.stringify(loadedOther)) } catch {}
  }, [loadedOther, raceId])
  useEffect(() => {
    if (!raceId) return
    try { localStorage.setItem(`equip:${raceId}:otherAmounts`, JSON.stringify(otherAmounts)) } catch {}
  }, [otherAmounts, raceId])

  const enteredRows = useMemo(() => rows.filter(r => r.status === 'entered'), [rows])

  // Group map: day -> group name -> set of divisions
  const groupMap = useMemo(() => {
    const m = new Map<string, Map<string, Set<string>>>()
    for (const g of groups) {
      if (!m.has(g.day)) m.set(g.day, new Map())
      const gm = m.get(g.day) as Map<string, Set<string>>
      gm.set(g.group, new Set(g.divisions || []))
    }
    return m
  }, [groups])

  // Assign each entered row to a day/group key. If not grouped, fallback to its own div as a pseudo-group
  const rowsByDayGroup = useMemo(() => {
    const out = new Map<string, Entry[]>()
    for (const r of enteredRows) {
      const dm = groupMap.get(r.day)
      let key = `${r.day}::__${r.div}`
      if (dm) {
        for (const [gname, set] of dm.entries()) {
          if (set.has(r.div)) { key = `${r.day}::${gname}`; break }
        }
      }
      if (!out.has(key)) out.set(key, [])
      ;(out.get(key) as Entry[]).push(r)
    }
    return out
  }, [enteredRows, groupMap])

  function inferPreciseBoatType(event: string): string | null {
    const e = event.toLowerCase()
    if (e.includes('8x+')) return '8x+'
    if (e.includes('8+')) return '8+'
    if (e.includes('4x+')) return '4x+'
    if (e.includes('4x-')) return '4x-'
    if (e.includes('4x')) return '4x'
    if (e.includes('4+')) return '4+'
    if (e.includes('4-')) return '4-'
    if (e.includes('2x-')) return '2x-'
    if (e.includes('2x')) return '2x'
    if (e.includes('2-')) return '2-'
    if (e.includes('1x-')) return '1x-'
    if (e.includes('1x')) return '1x'
    return null
  }

  function bladesRequiredFor(type: string | null): number {
    switch (type) {
      case '1x':
      case '1x-':
        return 2
      case '2-':
        return 2
      case '2x':
      case '2x-':
        return 4
      case '4-':
      case '4+':
        return 4
      case '4x':
      case '4x-':
      case '4x+':
        return 8
      case '8+':
        return 8
      case '8x+':
        return 16
      default:
        return 0
    }
  }

  // Compute max needed blades per set across all simultaneous groups
  const maxNeededByBlade = useMemo(() => {
    const byBladeMax = new Map<string, number>()
    for (const [, ers] of rowsByDayGroup.entries()) {
      const byBlade = new Map<string, number>()
      for (const e of ers) {
        const raw = (e.blades || '').trim()
        if (!raw) continue
        const parts = raw.includes('+') ? raw.split('+').map(s => s.trim()).filter(Boolean) : [raw]
        const type = inferPreciseBoatType(e.event || '')
        const needed = bladesRequiredFor(type)
        if (needed <= 0) continue
        const n = Math.max(1, parts.length)
        const base = Math.floor(needed / n)
        let rem = needed % n
        for (const p of parts) {
          const inc = base + (rem > 0 ? 1 : 0)
          if (rem > 0) rem -= 1
          byBlade.set(p, (byBlade.get(p) || 0) + inc)
        }
      }
      for (const [blade, used] of byBlade.entries()) {
        const cur = byBladeMax.get(blade) || 0
        if (used > cur) byBladeMax.set(blade, used)
      }
    }
    return byBladeMax
  }, [rowsByDayGroup])

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

  const bladeNameToRef = useMemo(() => {
    const m = new Map<string, Blade>()
    for (const b of bladesRef) m.set((b.name||'').trim(), b)
    return m
  }, [bladesRef])

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link to="/" className="secondary-btn">Back</Link>
      </div>
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
                  <th style={{ width: 120 }}>Needed</th>
                  <th style={{ width: 120 }}>Loaded</th>
                </tr>
              </thead>
              <tbody>
                {mapToSortedArray(overall.blades.map).map(([name, counted]) => {
                  const needed = maxNeededByBlade.get(name) || 0
                  return (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <span>{needed}</span>
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
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Other equipment</div>
          {otherSections.map((section) => (
            <div key={section.title}>
              <div className="section-title" style={{ marginBottom: 6 }}>{section.title}</div>
              <div className="table-scroll">
                <table className="sheet">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Item</th>
                      <th style={{ width: 120 }}>Amount</th>
                      <th style={{ width: 120 }}>Loaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((name) => {
                      const value = (name in otherAmounts) ? otherAmounts[name] : (otherDefaultAmounts[name] ?? '')
                      return (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={value}
                              onChange={(e)=> setOtherAmounts(prev => ({ ...prev, [name]: e.target.value }))}
                              style={{ width: 90 }}
                            />
                          </td>
                          <td>
                            <input type="checkbox" checked={!!loadedOther[name]} onChange={(e)=> setLoadedOther(prev => ({ ...prev, [name]: e.target.checked }))} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


