import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Entry } from '../models/entry'
import { subscribeEntries, updateEntry } from '../data/entries'
import { getRaceById, updateRace } from '../data/races'
import type { Race as RaceType } from '../models/race'
import { formatRaceTime, parseRaceTimeToMs } from '../utils/dates'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'
import { subscribeDivisionGroups, type DivisionGroup } from '../data/divisionGroups'
import type { Loadable } from '../models/ui'
import { LoadingState } from '../ui/components/LoadingState'
import { EmptyState } from '../ui/components/EmptyState'
import { ErrorBanner } from '../ui/components/ErrorBanner'
import { Button } from '../ui/components/Button'
import { Field } from '../ui/components/Field'
import { PageHeader } from '../ui/components/PageHeader'
import { toErrorMessage } from '../utils/errors'
 
 

export function Race() {
  const { raceId } = useParams()
  const [raceState, setRaceState] = useState<Loadable<RaceType | null>>({ status: 'loading' })
  const [entriesState, setEntriesState] = useState<Loadable<Entry[]>>({ status: 'loading' })
  const [groups, setGroups] = useState<DivisionGroup[]>([])
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter modal state via URL (?filter=1)
  const filterOpen = searchParams.get('filter') === '1'
  const closeFilter = () => { searchParams.delete('filter'); setSearchParams(searchParams, { replace: true }) }
  

  // Filter selections
  const [daySel, setDaySel] = useState<string[]>([])
  const [divSel, setDivSel] = useState<string[]>([])
  const [eventSel, setEventSel] = useState<string[]>([])
  const race = raceState.status === 'ready' ? raceState.data : null
  const rows = entriesState.status === 'ready' ? entriesState.data : []
  const [savingTimes, setSavingTimes] = useState(false)

  // Plain table — no filters/sorting

  useEffect(() => {
    if (!raceId) {
      setEntriesState({ status: 'ready', data: [] })
      return
    }
    setEntriesState({ status: 'loading' })
    return subscribeEntries(
      raceId,
      (data) => setEntriesState({ status: 'ready', data }),
      (err) => setEntriesState({ status: 'error', message: toErrorMessage(err) }),
    )
  }, [raceId])

  // Bring back lightweight division group subscription to support visual separators only
  useEffect(() => {
    if (!raceId) return
    return subscribeDivisionGroups(raceId, setGroups)
  }, [raceId])


  

  useEffect(() => {
    if (!raceId) {
      setRaceState({ status: 'ready', data: null })
      return
    }
    setRaceState({ status: 'loading' })
    ;(async () => {
      try {
        const r = await getRaceById(raceId)
        setRaceState({ status: 'ready', data: r })
      } catch (err) {
        setRaceState({ status: 'error', message: toErrorMessage(err) })
      }
    })()
  }, [raceId])

  const dayOptions = useMemo(() => {
    if (!race) return [] as string[]
    return enumerateDaysInclusive(race.startDate, race.endDate).map(formatDayLabel)
  }, [race])

  const enteredRows = useMemo(() => rows.filter((r) => r.status === 'entered'), [rows])

  // Build grouping map per day → group name → set of divisions (for separators only)
  const groupMap = useMemo(() => {
    const m = new Map<string, Map<string, Set<string>>>()
    for (const g of groups) {
      if (!m.has(g.day)) m.set(g.day, new Map())
      const gm = m.get(g.day) as Map<string, Set<string>>
      gm.set(g.group, new Set(g.divisions || []))
    }
    return m
  }, [groups])

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

  // Auto sort:
  // - If any entry has race times, sort by fastest time (min timeMs) first.
  // - Otherwise, sort by day (race day order) → div (with am<pm and short<long) → event.
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
      return { am, pm, shortW, longW }
    }
    const bestTime = (r: Entry): number | null => {
      const times = (r.raceTimes || []).map(t => t.timeMs).filter((n) => Number.isFinite(n) && (n as number) > 0) as number[]
      if (times.length === 0) return null
      return Math.min(...times)
    }
    const anyTimes = plainRows.some(r => (r.raceTimes || []).some(t => Number.isFinite(t.timeMs) && (t.timeMs as number) > 0))

    const fallbackCmp = (a: Entry, b: Entry) => {
      const ai = dayOrder.has(a.day) ? (dayOrder.get(a.day) as number) : 9999
      const bi = dayOrder.has(b.day) ? (dayOrder.get(b.day) as number) : 9999
      if (ai !== bi) return ai - bi
      const ar = divRank(a.div || '')
      const br = divRank(b.div || '')
      if ((ar.am || ar.pm) && (br.am || br.pm)) {
        const aOrder = ar.am ? 0 : ar.pm ? 1 : 2
        const bOrder = br.am ? 0 : br.pm ? 1 : 2
        if (aOrder !== bOrder) return aOrder - bOrder
      }
      if ((ar.shortW || ar.longW) && (br.shortW || br.longW)) {
        const aOrder = ar.shortW ? 0 : ar.longW ? 1 : 2
        const bOrder = br.shortW ? 0 : br.longW ? 1 : 2
        if (aOrder !== bOrder) return aOrder - bOrder
      }
      const d = collator.compare(a.div || '', b.div || '')
      if (d !== 0) return d
      // Within the same division (and day), if race times are not yet present,
      // order by crew number ascending (entries with a crew number first).
      const ac = a.crewNumber ?? null
      const bc = b.crewNumber ?? null
      const aHasCrew = ac != null
      const bHasCrew = bc != null
      if (aHasCrew && bHasCrew && ac! !== bc!) return (ac as number) - (bc as number)
      if (aHasCrew !== bHasCrew) return aHasCrew ? -1 : 1
      // Fallback to event name
      return collator.compare(a.event || '', b.event || '')
    }

    return [...plainRows].sort((a, b) => {
      if (anyTimes) {
        const at = bestTime(a)
        const bt = bestTime(b)
        const aHas = at != null
        const bHas = bt != null
        if (aHas && bHas && at! !== bt!) return (at as number) - (bt as number)
        if (aHas !== bHas) return aHas ? -1 : 1 // entries with times come first
      }
      return fallbackCmp(a, b)
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
    if (!editing || savingTimes) return
    const crewNumber = crewInput.trim() ? parseInt(crewInput, 10) : null
    if (crewInput.trim() && (!Number.isFinite(crewNumber) || crewNumber! < 0)) return
    const raceTimes = times
      .map(t => ({ round: t.round.trim(), timeMs: parseRaceTimeToMs(t.time) }))
      .filter(t => t.round && t.timeMs != null) as { round: string; timeMs: number }[]
    try {
      setSavingTimes(true)
      await updateEntry(editing.id, { crewNumber: crewNumber ?? null, raceTimes })
      setEditing(null)
    } catch (err) {
      alert('Failed to save times. Please try again.')
      console.error(err)
    } finally {
      setSavingTimes(false)
    }
  }

  return (
    <div className="print-root">
      <PageHeader
        title={race?.name ?? 'Race'}
        subtitle={
          race
            ? (() => {
                const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
                const start = race.startDate
                const end = race.endDate
                return end && end.getTime() !== start.getTime() ? `${fmt(start)} → ${fmt(end)}` : fmt(start)
              })()
            : 'View race entries and times.'
        }
        actions={
          race ? (
            <div className="print-hide" style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => { const p = new URLSearchParams(searchParams); p.set('filter','1'); setSearchParams(p, { replace: true }) }}>Filter</Button>
              <Button
                variant="secondary"
                disabled={!raceId || savingDraw}
                onClick={async () => {
                  if (!raceId) return
                  try {
                    setSavingDraw(true)
                    await updateRace(raceId, { drawReleased: !drawReleased })
                    setRaceState((prev) => {
                      if (prev.status !== 'ready') return prev
                      const current = prev.data
                      return { status: 'ready', data: current ? { ...current, drawReleased: !drawReleased } : current }
                    })
                  } finally {
                    setSavingDraw(false)
                  }
                }}
                title={drawReleased ? 'Disable times editing' : 'Enable times editing'}
              >
                {savingDraw ? 'Saving…' : drawReleased ? 'Draw released ✓' : 'Release draw'}
              </Button>
            </div>
          ) : null
        }
      />

      {raceState.status === 'error' ? <ErrorBanner message={`Race: ${raceState.message}`} /> : null}
      {entriesState.status === 'error' ? <ErrorBanner message={`Entries: ${entriesState.message}`} /> : null}
      {(raceState.status === 'loading' || entriesState.status === 'loading') ? <LoadingState label="Loading race entries..." /> : null}

      {entriesState.status === 'ready' && rows.length === 0 ? (
        <EmptyState title="No entries yet" description="Entries will appear here once added." />
      ) : (
        <>
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
            {(() => {
              const out: JSX.Element[] = []
              let prevKey: string | null = null
              for (const r of sortedRows) {
                // Determine grouping key for separator rendering
                let gkey = `${r.day}::__${r.div}`
                const dm = groupMap.get(r.day)
                if (dm) {
                  for (const [gname, set] of dm.entries()) {
                    if (set.has(r.div)) { gkey = `${r.day}::${gname}`; break }
                  }
                }
                const isGroupStart = prevKey !== null && gkey !== prevKey
                prevKey = gkey
                out.push(
                  <tr key={r.id} className={`${isGroupStart ? 'group-start' : ''} print-avoid-break`}>
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
                )
              }
              return out
            })()}
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
                  <Field
                    id="crew-number"
                    label="Crew number"
                    type="number"
                    value={crewInput}
                    onChange={(v) => setCrewInput(v)}
                    placeholder="e.g. 152"
                  />
                </div>

                <div className="form-row form-span-2">
                  <div className="section-title">Race times</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {times.map((t, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                        <Field
                          id={`time-round-${idx}`}
                          label="Round"
                          value={t.round}
                          onChange={(v) => setTimes(prev => prev.map((x,i)=> i===idx? { ...x, round: v }: x))}
                          placeholder="Round (Heat / Semi / Final)"
                        />
                        <Field
                          id={`time-value-${idx}`}
                          label="Time"
                          value={t.time}
                          onChange={(v) => setTimes(prev => prev.map((x,i)=> i===idx? { ...x, time: v }: x))}
                          placeholder="mm:ss(.SS)"
                        />
                        <Button type="button" variant="secondary" onClick={() => removeTimeRow(idx)}>Remove</Button>
                      </div>
                    ))}
                    <div>
                      <Button type="button" variant="secondary" onClick={addTimeRow}>Add time</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveTimes} disabled={savingTimes}>{savingTimes ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}


