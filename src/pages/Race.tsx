import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Entry } from '../models/entry'
import { subscribeEntries } from '../data/entries'
import { getRaceById, updateRace } from '../data/races'
import type { Race as RaceType } from '../models/race'
import { updateEntry } from '../data/entries'
import { formatRaceTime, parseRaceTimeToMs } from '../utils/dates'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'
import { subscribeDivisionGroups, type DivisionGroup, createDivisionGroup, updateDivisionGroup, deleteDivisionGroup } from '../data/divisionGroups'
import { createSilence, deleteSilenceByBoat, subscribeSilences, type Silence } from '../data/silences'

export function Race() {
  const { raceId } = useParams()
  const [race, setRace] = useState<RaceType | null>(null)
  const [rows, setRows] = useState<Entry[]>([])
  const [groups, setGroups] = useState<DivisionGroup[]>([])
  const [silences, setSilences] = useState<Silence[]>([])
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter modal state via URL (?filter=1)
  const filterOpen = searchParams.get('filter') === '1'
  const closeFilter = () => { searchParams.delete('filter'); setSearchParams(searchParams, { replace: true }) }
  const groupsOpen = searchParams.get('groups') === '1'
  const closeGroups = () => { searchParams.delete('groups'); setSearchParams(searchParams, { replace: true }) }

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
    return subscribeDivisionGroups(raceId, setGroups)
  }, [raceId])

  useEffect(() => {
    if (!raceId) return
    return subscribeSilences(raceId, setSilences)
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
  // Build grouping map per day → group name → set of divisions
  const groupMap = useMemo(() => {
    const m = new Map<string, Map<string, Set<string>>>()
    for (const g of groups) {
      if (!m.has(g.day)) m.set(g.day, new Map())
      const gm = m.get(g.day) as Map<string, Set<string>>
      gm.set(g.group, new Set(g.divisions || []))
    }
    return m
  }, [groups])

  // Assign each entered row to a day/group key. If div not in any group that day, fallback to its own group named by div.
  const rowsByDayGroup = useMemo(() => {
    const out = new Map<string, Entry[]>()
    for (const r of enteredRows) {
      const dm = groupMap.get(r.day)
      let key = `${r.day}::__${r.div}` // default solo group
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

  // Compute clashes per day/group: same boat appears >1 times
  const clashes = useMemo(() => {
    type Clash = { key: string; day: string; group: string; boat: string; count: number; entries: Entry[]; silenced: boolean }
    const list: Clash[] = []
    for (const [key, ers] of rowsByDayGroup.entries()) {
      const [day, group] = key.split('::')
      const byBoat = new Map<string, Entry[]>()
      for (const e of ers) {
        const boat = (e.boat || '').trim()
        if (!boat) continue
        if (!byBoat.has(boat)) byBoat.set(boat, [])
        byBoat.get(boat)!.push(e)
      }
      for (const [boat, es] of byBoat.entries()) {
        if (es.length > 1) {
          const silenced = silences.some(s => s.raceId === (raceId||'') && s.day === day && s.group === group && s.boat === boat)
          list.push({ key: `${day}::${group}::${boat}`, day, group, boat, count: es.length, entries: es, silenced })
        }
      }
    }
    // Sort clashes by day order then group name then boat
    const dayOrder = new Map<string, number>(dayOptions.map((d, i) => [d, i]))
    return list.sort((a,b) => {
      const ai = dayOrder.get(a.day) ?? 9999
      const bi = dayOrder.get(b.day) ?? 9999
      if (ai !== bi) return ai - bi
      if (a.group !== b.group) return a.group.localeCompare(b.group)
      return a.boat.localeCompare(b.boat)
    })
  }, [rowsByDayGroup, silences, dayOptions, raceId])

  const uniqueDivs = useMemo(() => Array.from(new Set(enteredRows.map(r => r.div).filter(Boolean))).sort(), [enteredRows])
  const uniqueDivsByDay = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const d of dayOptions) m.set(d, [])
    for (const r of enteredRows) {
      if (!m.has(r.day)) m.set(r.day, [])
      const arr = m.get(r.day) as string[]
      if (r.div && !arr.includes(r.div)) arr.push(r.div)
    }
    for (const [d, arr] of m) arr.sort()
    return m
  }, [enteredRows, dayOptions])
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
    const hasWord = (s: string, w: string) => new RegExp(`(^|[^a-zA-Z])${w}([^a-zA-Z]|$)`, 'i').test(s)
    const divRank = (s: string) => {
      const lower = (s || '').toLowerCase()
      const am = hasWord(lower, 'am')
      const pm = hasWord(lower, 'pm')
      const shortW = hasWord(lower, 'short')
      const longW = hasWord(lower, 'long')
      // Only apply ordering when both sides contain an am/pm marker or short/long marker.
      return { am, pm, shortW, longW }
    }
    return [...plainRows].sort((a, b) => {
      const ai = dayOrder.has(a.day) ? (dayOrder.get(a.day) as number) : 9999
      const bi = dayOrder.has(b.day) ? (dayOrder.get(b.day) as number) : 9999
      if (ai !== bi) return ai - bi
      const ar = divRank(a.div || '')
      const br = divRank(b.div || '')
      // am before pm when both have am/pm markers
      if ((ar.am || ar.pm) && (br.am || br.pm)) {
        const aOrder = ar.am ? 0 : ar.pm ? 1 : 2
        const bOrder = br.am ? 0 : br.pm ? 1 : 2
        if (aOrder !== bOrder) return aOrder - bOrder
      }
      // short before long when both have short/long markers
      if ((ar.shortW || ar.longW) && (br.shortW || br.longW)) {
        const aOrder = ar.shortW ? 0 : ar.longW ? 1 : 2
        const bOrder = br.shortW ? 0 : br.longW ? 1 : 2
        if (aOrder !== bOrder) return aOrder - bOrder
      }
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
  const [groupsDay, setGroupsDay] = useState<string>('')

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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button className="secondary-btn" onClick={() => { const p = new URLSearchParams(searchParams); p.set('filter','1'); setSearchParams(p, { replace: true }) }}>Filter</button>
        <button className="secondary-btn" onClick={() => { const p = new URLSearchParams(searchParams); p.set('groups','1'); setSearchParams(p, { replace: true }); if (!groupsDay) setGroupsDay(dayOptions[0] || '') }}>Groups</button>
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

      {clashes.length > 0 && (
        <div className="clashes">
          {clashes.map((c) => (
            <div key={c.key} className="clash">
              <div className="clash-header">
                <div className="clash-title">Boat clash: {c.boat}</div>
                <div className="clash-actions">
                  {c.silenced ? (
                    <button className="row-action" onClick={() => deleteSilenceByBoat(raceId||'', c.day, c.group, c.boat)}>Unsilence</button>
                  ) : (
                    <button className="row-action" onClick={() => createSilence({ raceId: raceId||'', day: c.day, group: c.group, boat: c.boat })}>Silence</button>
                  )}
                </div>
              </div>
              <div className="clash-meta">
                <span>Day: {c.day}</span>
                <span>Group: {c.group.replace(/^__/, '')}</span>
                <span>Count: {c.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="table-scroll">
        <table className="sheet">
          <thead>
            <tr>
              <th style={{ minWidth: 90 }}>Day</th>
              <th style={{ minWidth: 70 }}>Div</th>
              <th style={{ minWidth: 140 }}>Event</th>
              <th style={{ minWidth: 320 }}>Athlete Names</th>
              <th style={{ minWidth: 160 }}>Boat</th>
              <th style={{ minWidth: 160 }}>Blades</th>
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

      {groupsOpen && (
        <div className="modal-overlay" onClick={closeGroups}>
          <div className="modal-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Manage division groups</div>
              <button className="icon-btn" onClick={closeGroups} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-row">
                  <label className="section-title">Day</label>
                  <select value={groupsDay} onChange={(e)=> setGroupsDay(e.target.value)}>
                    {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-row form-span-2">
                  <div className="section-title">Groups on {groupsDay || '-'}</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {groups.filter(g => g.day === groupsDay).map((g) => (
                      <div key={g.id} className="card" style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                          <input value={g.group} onChange={(e)=> updateDivisionGroup(g.id, { group: e.target.value })} placeholder="Group name (e.g. Block A)" />
                          <button className="row-action" onClick={() => deleteDivisionGroup(g.id)}>Delete</button>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Divisions</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                            {Array.from(uniqueDivsByDay.get(groupsDay || '') || []).map((dv) => {
                              const checked = (g.divisions || []).includes(dv)
                              return (
                                <label key={dv} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                                  <input type="checkbox" checked={checked} onChange={(e)=> {
                                    const next = new Set(g.divisions || [])
                                    if (e.target.checked) next.add(dv); else next.delete(dv)
                                    updateDivisionGroup(g.id, { divisions: Array.from(next) })
                                  }} />
                                  {dv}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div>
                      <button className="row-action" onClick={() => { if (!raceId || !groupsDay) return; createDivisionGroup({ id: '', raceId, day: groupsDay, group: 'Group', divisions: [] } as any) }}>Add group</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={closeGroups}>Done</button>
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


