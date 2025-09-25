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
    if (type.startsWith('8')) return 0 // eights / octuples
    if (type.startsWith('4')) return 1 // quads / fours
    if (type.startsWith('2')) return 2 // doubles / pairs
    if (type.startsWith('1')) return 3 // singles
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

      {/* Overall requirements */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Overall requirements</div>
        <div className="table-scroll" style={{ marginBottom: 10 }}>
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Boats</th>
                <th style={{ width: 120 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {sortBoatsWithGroups(overall.boats.map).map((item, idx) => (
                item.kind === 'sep' ? (
                  <tr key={`sep-${idx}`} className="group-sep"><td colSpan={2}></td></tr>
                ) : (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.count}</td>
                  </tr>
                )
              ))}
              {overall.boats.map.size === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>No boats assigned yet</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="table-scroll">
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Blades</th>
                <th style={{ width: 120 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {mapToSortedArray(overall.blades.map).map(([name, count]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {overall.blades.map.size === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>No blades assigned yet</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, color: 'var(--muted)' }}>
          <div>Missing boat assignments: {overall.boats.missing}</div>
          <div>Missing blade assignments: {overall.blades.missing}</div>
        </div>
      </div>

      {/* Per day breakdown */}
      <div style={{ display: 'grid', gap: 12 }}>
        {dayOptions.map((d) => {
          const data = byDay.get(d)
          if (!data) return null
          return (
            <div key={d} className="card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Requirements on {d}</div>
              <div className="table-scroll" style={{ marginBottom: 8 }}>
                <table className="sheet">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Boats</th>
                      <th style={{ width: 120 }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortBoatsWithGroups(data.boats.map).map((item, idx) => (
                      item.kind === 'sep' ? (
                        <tr key={`sep-${idx}`} className="group-sep"><td colSpan={2}></td></tr>
                      ) : (
                        <tr key={item.name}>
                          <td>{item.name}</td>
                          <td>{item.count}</td>
                        </tr>
                      )
                    ))}
                    {data.boats.map.size === 0 ? (
                      <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>No boats assigned</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="table-scroll">
                <table className="sheet">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Blades</th>
                      <th style={{ width: 120 }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapToSortedArray(data.blades.map).map(([name, count]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                    {data.blades.map.size === 0 ? (
                      <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>No blades assigned</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, color: 'var(--muted)' }}>
                <div>Missing boat assignments: {data.boats.missing}</div>
                <div>Missing blade assignments: {data.blades.missing}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


