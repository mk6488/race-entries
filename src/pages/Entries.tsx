import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { subscribeEntries, createEntry, updateEntry } from '../data/entries'
import { subscribeBlades, type Blade } from '../data/blades'
import { subscribeBoats, type Boat } from '../data/boats'
import { getRaceById } from '../data/races'
import { subscribeDivisionGroups, type DivisionGroup, createDivisionGroup, updateDivisionGroup, deleteDivisionGroup } from '../data/divisionGroups'
import { subscribeSilences, createSilence, deleteSilenceByBoat, type Silence } from '../data/silences'
import { subscribeBlades } from '../data/blades'
import { subscribeBladeSilences, createBladeSilence, deleteBladeSilenceByBlade, type BladeSilence } from '../data/silencedBlades'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'
import type { Race } from '../models/race'
import type { Entry, NewEntry } from '../models/entry'
import { Modal } from '../ui/Modal'

export function Entries() {
  const { raceId } = useParams()
  const [rows, setRows] = useState<Entry[]>([])
  const [race, setRace] = useState<Race | null>(null)
  const [dayOptions, setDayOptions] = useState<string[]>([])
  const [allBoats, setAllBoats] = useState<Boat[]>([])
  const [bladeOptions, setBladeOptions] = useState<Blade[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewEntry | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const athleteInputRef = useRef<HTMLInputElement | null>(null)
  const [lastDefaults, setLastDefaults] = useState<Partial<NewEntry>>({})
  const [searchParams, setSearchParams] = useSearchParams()
  const [splitBlades, setSplitBlades] = useState(false)
  const [splitA, setSplitA] = useState('')
  const [splitB, setSplitB] = useState('')
  const [groups, setGroups] = useState<DivisionGroup[]>([])
  const [silences, setSilences] = useState<Silence[]>([])
  const [bladeSilences, setBladeSilences] = useState<BladeSilence[]>([])
  const groupsOpen = searchParams.get('groups') === '1'
  const closeGroups = () => { searchParams.delete('groups'); setSearchParams(searchParams, { replace: true }) }
  const [groupsDay, setGroupsDay] = useState<string>('')

  useEffect(() => {
    if (!raceId) return
    const unsub = subscribeEntries(raceId, setRows)
    return () => unsub()
  }, [raceId])

  useEffect(() => {
    const unsub = subscribeBlades(setBladeOptions)
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeBoats(setAllBoats)
    return () => unsub()
  }, [])

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
    return subscribeBladeSilences(raceId, setBladeSilences)
  }, [raceId])

  // Ensure navbar Add Entry (?add=1) opens the same prefilled modal as the Add entry button
  useEffect(() => {
    if (searchParams.get('add') === '1' && raceId && !form) {
      const blank: NewEntry = {
        raceId,
        day: (lastDefaults.day as string) ?? (dayOptions[0] ?? ''),
        div: (lastDefaults.div as string) ?? '',
        event: (lastDefaults.event as string) ?? '',
        athleteNames: '',
        boat: (lastDefaults.boat as string) ?? '',
        blades: (lastDefaults.blades as string) ?? '',
        notes: '',
        status: 'in_progress',
        crewChanged: false,
      }
      setForm(blank)
      setOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('add')
      setSearchParams(next)
    }
  }, [searchParams, raceId, form, dayOptions, lastDefaults])

  function inferBoatType(event: string): string | null {
    const e = event.toLowerCase()
    if (e.includes('8x+') || e.includes('8+')) return '8+'
    if (e.includes('4x+') || e.includes('4+')) return '4+'
    if (e.includes('4x') || e.includes('4x-') || e.includes('4-')) return '4x/-'
    if (e.includes('2x') || e.includes('2x-') || e.includes('2-')) return '2x/-'
    if (e.includes('1x') || e.includes('1x-')) return '1x'
    return null
  }

  // Initialize split blades state when opening the modal
  useEffect(() => {
    if (!open || !form) return
    const raw = (form.blades || '').trim()
    const parts = raw.includes('+') ? raw.split('+').map((s) => s.trim()).filter(Boolean) : []
    if (parts.length === 2) {
      setSplitBlades(true)
      setSplitA(parts[0] || '')
      setSplitB(parts[1] || '')
    } else {
      setSplitBlades(false)
      setSplitA('')
      setSplitB('')
    }
  }, [open, form])

  const sortedRows = useMemo(() => {
    const dayRank: Record<string, number> = {}
    dayOptions.forEach((d, i) => { dayRank[d] = i })
    const parseMaybeNum = (s: string) => {
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }
    const hasWord = (s: string, w: string) => new RegExp(`(^|[^a-zA-Z])${w}([^a-zA-Z]|$)`, 'i').test(s)
    const cmp = (a: Entry, b: Entry) => {
      const ar = dayRank[a.day] ?? 9999
      const br = dayRank[b.day] ?? 9999
      if (ar !== br) return ar - br
      const ad = a.div.trim(); const bd = b.div.trim()
      const adn = parseMaybeNum(ad); const bdn = parseMaybeNum(bd)
      if (adn !== null && bdn !== null && adn !== bdn) return adn - bdn
      // Special handling: am before pm, short before long when both sides contain them
      const aAm = hasWord(ad, 'am'); const aPm = hasWord(ad, 'pm');
      const bAm = hasWord(bd, 'am'); const bPm = hasWord(bd, 'pm');
      if ((aAm || aPm) && (bAm || bPm)) {
        const aOrder = aAm ? 0 : aPm ? 1 : 2
        const bOrder = bAm ? 0 : bPm ? 1 : 2
        if (aOrder !== bOrder) return aOrder - bOrder
      }
      const aShort = hasWord(ad, 'short'); const aLong = hasWord(ad, 'long');
      const bShort = hasWord(bd, 'short'); const bLong = hasWord(bd, 'long');
      if ((aShort || aLong) && (bShort || bLong)) {
        const aOrder = aShort ? 0 : aLong ? 1 : 2
        const bOrder = bShort ? 0 : bLong ? 1 : 2
        if (aOrder !== bOrder) return aOrder - bOrder
      }
      const divCmp = ad.localeCompare(bd, undefined, { sensitivity: 'base', numeric: true })
      if (divCmp !== 0) return divCmp
      return a.event.localeCompare(b.event, undefined, { sensitivity: 'base', numeric: true })
    }
    return [...rows].sort(cmp)
  }, [rows, dayOptions])

  // Entered-only rows for clash checks and grouping
  const enteredRows = useMemo(() => rows.filter(r => r.status === 'entered'), [rows])

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

  // Compute blade usage per day/group and detect when usage exceeds available amount
  const bladeClashes = useMemo(() => {
    type Clash = { key: string; day: string; group: string; blade: string; used: number; amount: number; silenced: boolean }
    const avail = new Map<string, number>() // blade name -> amount
    // Leverage blade options list already fetched elsewhere
    // We rely on Equipment's blades collection; fetch here too for robustness
    // Since we don't keep it in state here, we infer availability by counting max seen in entries unless provided in blades ref
    // For now, default to Infinity if no amount known (no clash)
    const list: Clash[] = []
    for (const [key, ers] of rowsByDayGroup.entries()) {
      const [day, group] = key.split('::')
      const byBlade = new Map<string, number>()
      for (const e of ers) {
        const raw = (e.blades || '').trim()
        if (!raw) continue
        const parts = raw.includes('+') ? raw.split('+').map(s => s.trim()).filter(Boolean) : [raw]
        for (const p of parts) byBlade.set(p, (byBlade.get(p) || 0) + 1)
      }
      for (const [blade, used] of byBlade.entries()) {
        const amount = Number.isFinite(avail.get(blade) as any) ? (avail.get(blade) as number) : Infinity
        if (amount !== Infinity && used > amount) {
          const silenced = bladeSilences.some(s => s.raceId === (raceId||'') && s.day === day && s.group === group && s.blade === blade)
          list.push({ key: `${day}::${group}::${blade}`, day, group, blade, used, amount, silenced })
        }
      }
    }
    const dayOrder = new Map<string, number>(dayOptions.map((d, i) => [d, i]))
    return list.sort((a,b) => {
      const ai = dayOrder.get(a.day) ?? 9999
      const bi = dayOrder.get(b.day) ?? 9999
      if (ai !== bi) return ai - bi
      if (a.group !== b.group) return a.group.localeCompare(b.group)
      return a.blade.localeCompare(b.blade)
    })
  }, [rowsByDayGroup, bladeSilences, dayOptions, raceId])

  const clashLookup = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const c of clashes) {
      m.set(`${c.day}::${c.group}::${c.boat}`, c.silenced)
    }
    return m
  }, [clashes])

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

  useEffect(() => {
    if (!raceId) return
    ;(async () => {
      const r = await getRaceById(raceId)
      setRace(r)
      if (!r) { setDayOptions([]); return }
      const days = enumerateDaysInclusive(r.startDate, r.endDate)
      setDayOptions(days.map(formatDayLabel))
    })()
  }, [raceId])

  async function addRow() {
    if (!raceId) return
    const blank: NewEntry = {
      raceId,
      day: (lastDefaults.day as string) ?? (dayOptions[0] ?? ''),
      div: (lastDefaults.div as string) ?? '',
      event: (lastDefaults.event as string) ?? '',
      athleteNames: '',
      boat: (lastDefaults.boat as string) ?? '',
      blades: (lastDefaults.blades as string) ?? '',
      notes: '',
      status: 'in_progress',
      crewChanged: false,
    }
    setForm(blank)
    setOpen(true)
    setEditingId(null)
  }

  async function updateCell(id: string, patch: Partial<NewEntry>) {
    const nextPatch: Partial<NewEntry> = { ...patch }
    if (typeof nextPatch.status === 'string') {
      const s = nextPatch.status
      if (s === 'withdrawn' || s === 'rejected') {
        nextPatch.crewChanged = false
      }
    }
    await updateEntry(id, nextPatch)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{race?.name ?? 'Selected race'}</h1>
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
        {/* Add Entry button moved to navbar */}
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <button className="secondary-btn" onClick={() => { const p = new URLSearchParams(searchParams); p.set('groups','1'); setSearchParams(p, { replace: true }); if (!groupsDay) setGroupsDay(dayOptions[0] || '') }}>Div Groups</button>
        </div>
      </div>
      {(clashes.length > 0 || bladeClashes.length > 0) && (
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
          {bladeClashes.map((c) => (
            <div key={c.key} className="clash">
              <div className="clash-header">
                <div className="clash-title">Blade clash: {c.blade}</div>
                <div className="clash-actions">
                  {c.silenced ? (
                    <button className="row-action" onClick={() => deleteBladeSilenceByBlade(raceId||'', c.day, c.group, c.blade)}>Unsilence</button>
                  ) : (
                    <button className="row-action" onClick={() => createBladeSilence({ raceId: raceId||'', day: c.day, group: c.group, blade: c.blade })}>Silence</button>
                  )}
                </div>
              </div>
              <div className="clash-meta">
                <span>Day: {c.day}</span>
                <span>Group: {c.group.replace(/^__/, '')}</span>
                <span>Used: {c.used}</span>
                <span>Available: {c.amount}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="entries-list">
        {sortedRows.map((r) => {
          const dayIndex = Math.max(0, dayOptions.indexOf(r.day))
          const divIndex = (() => {
            const n = Number(r.div)
            if (Number.isFinite(n)) return Math.min(5, Math.max(0, n % 6))
            return (r.div || '').toUpperCase().charCodeAt(0) % 6
          })()
          // Determine current entry's group key for clash lookup
          let gkey = `${r.day}::__${r.div}`
          const dm = groupMap.get(r.day)
          if (dm) {
            for (const [gname, set] of dm.entries()) {
              if (set.has(r.div)) { gkey = `${r.day}::${gname}`; break }
            }
          }
          const trimmedBoat = (r.boat || '').trim()
          const clashKey = `${gkey}::${trimmedBoat}`
          const hasClash = !!trimmedBoat && clashLookup.has(clashKey)
          const isSilenced = hasClash ? (clashLookup.get(clashKey) as boolean) : false
          return (
          <div
            key={r.id}
            className={`entry-card ${r.status === 'withdrawn' || r.status === 'rejected' ? r.status : ''} ${r.crewChanged ? 'changed' : ''}`}
            onClick={() => {
              if (!raceId) return
              const initial: NewEntry = {
                raceId,
                day: r.day,
                div: r.div,
                event: r.event,
                athleteNames: r.athleteNames,
                boat: r.boat,
                blades: r.blades,
                notes: r.notes,
                status: r.status || 'ready',
                crewChanged: r.crewChanged || false,
              }
              setForm(initial)
              setEditingId(r.id)
              setOpen(true)
            }}
          >
            {/* Desktop inline row */}
            <div className="desktop-only">
              <div className="entry-inline">
                <div>{r.day || '-'}</div>
                <div>{r.div || '-'}</div>
                <div>{r.event || '-'}</div>
                <div>{r.athleteNames || '-'}</div>
                <div>
                  {r.boat || '-'}
                  {hasClash ? (
                    <span className={`clash-icon ${isSilenced ? 'silenced' : 'active'}`} title={isSilenced ? 'Clash silenced' : 'Boat clash'} style={{ marginLeft: 6 }}>
                      {isSilenced ? '⚠️' : '🚨'}
                    </span>
                  ) : null}
                </div>
                <div>{r.blades || '-'}</div>
                <div>
                  <span
                    className={`status ${r.status}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      const cycle = ['in_progress','ready','entered','withdrawn','rejected'] as const
                      const next = cycle[(cycle.indexOf((r.status as any)) + 1) % cycle.length]
                      updateCell(r.id, { status: next as any })
                    }}
                    title="Click to change status"
                    style={{ cursor: 'pointer' }}
                  >{r.status.replace('_',' ')}</span>
                </div>
                <div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e)=>e.stopPropagation()}>
                    <input type="checkbox" disabled={r.status==='withdrawn'||r.status==='rejected'} checked={r.crewChanged} onChange={(e)=>updateCell(r.id,{ crewChanged: e.target.checked })} />
                    Crew changed
                  </label>
                </div>
              </div>
              {r.notes?.trim() ? <div className="entry-notes">{r.notes}</div> : null}
            </div>

            {/* Mobile 5x3 grid layout (data only) */}
            <div className="mobile-only entry-mobile-grid">
              {/* Row 1: date | div | event */}
              <div className={`mono cell`}>{r.day || '-'}</div>
              <div className={`mono cell`}>Div {r.div || '-'}</div>
              <div className="cell event">{r.event || '-'}</div>
              {/* Row 2: athlete names (span 3) */}
              <div className="cell names col-span-3">{r.athleteNames || '-'}</div>
              {/* Row 3: boat (span 2) | blades */}
              <div className="cell boat col-span-2">
                <span className="muted-label">Boat:</span> {r.boat || '-'}
                {hasClash ? (
                  <span className={`clash-icon ${isSilenced ? 'silenced' : 'active'}`} title={isSilenced ? 'Clash silenced' : 'Boat clash'} style={{ marginLeft: 6 }}>
                    {isSilenced ? '⚠️' : '🚨'}
                  </span>
                ) : null}
              </div>
              <div className="cell blades"><span className="muted-label">Blades:</span> {r.blades || '-'}</div>
              {/* Row 4: status | EMPTY | crew changed */}
              <div className="cell">
                <span
                  className={`status ${r.status}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    const cycle = ['in_progress','ready','entered','withdrawn','rejected'] as const
                    const next = cycle[(cycle.indexOf((r.status as any)) + 1) % cycle.length]
                    updateCell(r.id, { status: next as any })
                  }}
                  title="Click to change status"
                >{r.status.replace('_',' ')}</span>
              </div>
              <div className="cell" />
              <div className="cell" onClick={(e)=>e.stopPropagation()}>
                <label className="changes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Changes
                  <input type="checkbox" disabled={r.status==='withdrawn'||r.status==='rejected'} checked={r.crewChanged} onChange={(e)=>updateCell(r.id,{ crewChanged: e.target.checked })} />
                </label>
              </div>
              {/* Row 5: notes when present (span 3) */}
              {r.notes?.trim() ? <div className="cell notes col-span-3 entry-notes">{r.notes}</div> : null}
            </div>
          </div>
          )
        })}
      </div>
      <Modal open={open} onClose={() => { setOpen(false); setForm(null); setEditingId(null) }} title={editingId ? 'Edit entry' : 'Add entry'} footer={null}>
        {form && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (editingId) {
                await updateEntry(editingId, form)
              } else {
                await createEntry(form)
              }
              setOpen(false)
              searchParams.delete('add')
              setSearchParams(searchParams)
              setForm(null)
              setEditingId(null)
            }}
            className="form-grid"
            onKeyDown={(e) => {
              if ((e.key === 'Enter' && (e.metaKey || e.shiftKey)) && !editingId && form) {
                e.preventDefault()
                ;(async () => {
                  await createEntry(form)
                  const nextDefaults: Partial<NewEntry> = { day: form.day, div: form.div, event: form.event, boat: form.boat, blades: form.blades }
                  setLastDefaults(nextDefaults)
                  setForm({ ...form, athleteNames: '', notes: '', status: 'in_progress', crewChanged: false })
                  requestAnimationFrame(() => athleteInputRef.current?.focus())
                })()
              }
            }}
          >
            <div className="form-row">
              <label>Day</label>
              <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Div</label>
              <input value={form.div} onChange={(e) => setForm({ ...form, div: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Event</label>
              <input
                value={form.event}
                onChange={(e) => {
                  const next = e.target.value
                  const type = inferBoatType(next.trim())
                  const options = type && next.trim() ? allBoats.filter((b) => b.type === type) : []
                  const valid = options.some((b) => b.name === form.boat)
                  setForm({ ...form, event: next, boat: valid ? form.boat : '' })
                }}
              />
            </div>
            <div className="form-row form-span-2">
              <label>Athlete Names</label>
              <input ref={athleteInputRef} value={form.athleteNames} onChange={(e) => setForm({ ...form, athleteNames: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Boat</label>
              {(() => {
                const type = inferBoatType(form.event.trim())
                const options = type && form.event.trim()
                  ? allBoats.filter((b) => b.type === type).sort((a,b) => a.name.localeCompare(b.name))
                  : []
                return (
                  <select value={form.boat} onChange={(e) => setForm({ ...form, boat: e.target.value })}>
                    <option value="">-</option>
                    {options.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                )
              })()}
            </div>
            <div className="form-row col-span-2-lg">
              <label>Blades</label>
              {!splitBlades ? (
                <>
                  <select value={form.blades} onChange={(e) => setForm({ ...form, blades: e.target.value })}>
                    <option value="">-</option>
                    {bladeOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  <label style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={splitBlades}
                      onChange={(e) => {
                        const enable = e.target.checked
                        setSplitBlades(enable)
                        if (enable) {
                          // initialize from single value
                          const single = (form.blades || '').trim()
                          setSplitA(single)
                          setSplitB('')
                        }
                      }}
                    />
                    Use two sets
                  </label>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>
                    <select value={splitA} onChange={(e) => {
                      const v = e.target.value
                      setSplitA(v)
                      const combined = [v, splitB].filter((x) => x && x !== '-').join(' + ')
                      setForm({ ...form, blades: combined })
                    }}>
                      <option value="">-</option>
                      {bladeOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                    <select value={splitB} onChange={(e) => {
                      const v = e.target.value
                      setSplitB(v)
                      const combined = [splitA, v].filter((x) => x && x !== '-').join(' + ')
                      setForm({ ...form, blades: combined })
                    }}>
                      <option value="">-</option>
                      {bladeOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <label style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={splitBlades}
                      onChange={(e) => {
                        const enable = e.target.checked
                        if (!enable) {
                          // collapse to single value (prefer A then B)
                          const single = splitA || splitB || ''
                          setForm({ ...form, blades: single })
                        }
                        setSplitBlades(enable)
                      }}
                    />
                    Use two sets
                  </label>
                </>
              )}
            </div>
            <div className="form-row form-span-2">
              <label>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-span-2" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {!editingId ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>Tip: Shift+Enter to "Add & add another"</span> : <span />}
              <span style={{ display: 'inline-flex', gap: 8 }}>
                <button type="button" onClick={() => { setOpen(false); searchParams.delete('add'); setSearchParams(searchParams); setForm(null); setEditingId(null) }} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>Cancel</button>
                {!editingId && (
                  <button type="button" onClick={async () => {
                    if (!form) return
                    await createEntry(form)
                    const nextDefaults: Partial<NewEntry> = { day: form.day, div: form.div, event: form.event, boat: form.boat, blades: form.blades }
                    setLastDefaults(nextDefaults)
                    setForm({ ...form, athleteNames: '', notes: '', status: 'in_progress', crewChanged: false })
                    requestAnimationFrame(() => athleteInputRef.current?.focus())
                  }}>Add & add another</button>
                )}
                <button type="submit">{editingId ? 'Save' : 'Add'}</button>
              </span>
            </div>
          </form>
        )}
      </Modal>
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
                      <button className="row-action" onClick={() => { if (!raceId || !groupsDay) return; createDivisionGroup({ raceId, day: groupsDay, group: 'Group', divisions: [] } as any) }}>Add group</button>
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
    </div>
  )
}


