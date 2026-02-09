import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { subscribeEntries, createEntry, updateEntry } from '../data/entries'
import { subscribeBlades, type Blade } from '../data/blades'
import { subscribeBoats, type Boat } from '../data/boats'
import { getRaceById } from '../data/races'
import { subscribeDivisionGroups, type DivisionGroup, createDivisionGroup, updateDivisionGroup, deleteDivisionGroup } from '../data/divisionGroups'
import { subscribeSilences, createSilence, deleteSilenceByBoat, type Silence } from '../data/silences'
import { subscribeBladeSilences, createBladeSilence, deleteBladeSilenceByBlade, type BladeSilence } from '../data/silencedBlades'
import { enumerateDaysInclusive, formatDayLabel } from '../utils/dates'
import type { Race } from '../models/race'
import type { Entry, NewEntry } from '../models/entry'
import type { Loadable } from '../models/ui'
import { Modal } from '../ui/Modal'
import { LoadingState } from '../ui/components/LoadingState'
import { EmptyState } from '../ui/components/EmptyState'
import { ErrorBanner } from '../ui/components/ErrorBanner'
import { Button } from '../ui/components/Button'
import { Field } from '../ui/components/Field'
import { PageHeader } from '../ui/components/PageHeader'
import { confirmDanger } from '../utils/confirm'
import { toErrorMessage } from '../utils/errors'
import { buildGroupMap, computeBladeClashes, computeBoatClashes, groupEntriesByDayGroup } from '../utils/clashes'

export function Entries() {
  const { raceId } = useParams()
  const [entriesState, setEntriesState] = useState<Loadable<Entry[]>>({ status: 'loading' })
  const [raceState, setRaceState] = useState<Loadable<Race | null>>({ status: 'loading' })
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
  const [bladeRefs, setBladeRefs] = useState<Blade[]>([])
  const groupsOpen = searchParams.get('groups') === '1'
  const closeGroups = () => { searchParams.delete('groups'); setSearchParams(searchParams, { replace: true }) }
  const [groupsDay, setGroupsDay] = useState<string>('')
  const [savingEntry, setSavingEntry] = useState(false)
  const rows = entriesState.status === 'ready' ? entriesState.data : []
  const race = raceState.status === 'ready' ? raceState.data : null

  function getDivisionOwnerMap(day: string) {
    const map = new Map<string, { groupId: string; groupName: string }>()
    if (!day) return map
    for (const g of groups.filter((row) => row.day === day)) {
      for (const dv of g.divisions || []) {
        if (!map.has(dv)) map.set(dv, { groupId: g.id, groupName: g.group })
      }
    }
    return map
  }

  const divisionOwnerMap = useMemo(
    () => (groupsDay ? getDivisionOwnerMap(groupsDay) : new Map<string, { groupId: string; groupName: string }>()),
    [groupsDay, groups],
  )

  async function toggleDivisionAssignment(day: string, targetGroupId: string, dv: string, checked: boolean) {
    if (!day) return
    const groupsForDay = groups.filter((g) => g.day === day)
    const target = groupsForDay.find((g) => g.id === targetGroupId)
    if (!target) return

    if (!checked) {
      const next = new Set(target.divisions || [])
      next.delete(dv)
      await updateDivisionGroup(target.id, { divisions: Array.from(next) })
      return
    }

    const owner = divisionOwnerMap.get(dv)
    if (owner?.groupId === targetGroupId && (target.divisions || []).includes(dv)) return

    const updates: Promise<unknown>[] = []
    if (owner && owner.groupId !== targetGroupId) {
      const ownerGroup = groupsForDay.find((g) => g.id === owner.groupId)
      if (ownerGroup) {
        const nextOwner = new Set(ownerGroup.divisions || [])
        nextOwner.delete(dv)
        updates.push(updateDivisionGroup(ownerGroup.id, { divisions: Array.from(nextOwner) }))
      }
    }
    const nextTarget = new Set(target.divisions || [])
    nextTarget.add(dv)
    updates.push(updateDivisionGroup(target.id, { divisions: Array.from(nextTarget) }))
    await Promise.all(updates)
  }

  useEffect(() => {
    if (!raceId) {
      setEntriesState({ status: 'ready', data: [] })
      return
    }
    setEntriesState({ status: 'loading' })
    const unsub = subscribeEntries(
      raceId,
      (data) => setEntriesState({ status: 'ready', data }),
      (err) => setEntriesState({ status: 'error', message: toErrorMessage(err) }),
    )
    return () => unsub()
  }, [raceId])

  useEffect(() => {
    const unsub = subscribeBlades((rows) => {
      setBladeOptions(rows)
      setBladeRefs(rows)
    })
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

  // Entered-only rows for filters and grouping labels
  const enteredRows = useMemo(() => rows.filter(r => r.status === 'entered'), [rows])

  // Build grouping map per day → group name → set of divisions
  const groupMap = useMemo(() => buildGroupMap(groups), [groups])

  // Assign each entered row to a day/group key. If div not in any group that day, fallback to its own group named by div.
  const rowsByDayGroup = useMemo(() => groupEntriesByDayGroup(rows, groupMap), [rows, groupMap])

  // Compute clashes per day/group: same boat appears >1 times
  const clashes = useMemo(
    () => computeBoatClashes(rowsByDayGroup, silences, raceId, dayOptions),
    [rowsByDayGroup, silences, dayOptions, raceId],
  )

  // Compute blade usage per day/group and detect when usage exceeds available amount
  const bladeClashes = useMemo(
    () => computeBladeClashes(rowsByDayGroup, bladeRefs, bladeSilences, dayOptions, raceId),
    [rowsByDayGroup, bladeSilences, dayOptions, raceId, bladeRefs],
  )

  const bladeClashLookup = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const c of bladeClashes) {
      m.set(`${c.day}::${c.group}::${c.blade}`, c.silenced)
    }
    return m
  }, [bladeClashes])

  const clashLookup = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const c of clashes) {
      m.set(`${c.day}::${c.group}::${c.boat}`, c.silenced)
    }
    return m
  }, [clashes])
  const uniqueDivsByDay = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const d of dayOptions) m.set(d, [])
    for (const r of enteredRows) {
      if (!m.has(r.day)) m.set(r.day, [])
      const arr = m.get(r.day) as string[]
      if (r.div && !arr.includes(r.div)) arr.push(r.div)
    }
    for (const [, arr] of m) arr.sort()
    return m
  }, [enteredRows, dayOptions])

  useEffect(() => {
    if (!raceId) {
      setRaceState({ status: 'ready', data: null })
      setDayOptions([])
      return
    }
    setRaceState({ status: 'loading' })
    ;(async () => {
      try {
      const r = await getRaceById(raceId)
        setRaceState({ status: 'ready', data: r })
      if (!r) { setDayOptions([]); return }
      const days = enumerateDaysInclusive(r.startDate ?? new Date(0), r.endDate ?? null)
      setDayOptions(days.map(formatDayLabel))
      } catch (err) {
        setRaceState({ status: 'error', message: toErrorMessage(err) })
      }
    })()
  }, [raceId])

  // Assign a stable color per day+group (or day+div fallback) for visual separation
  const groupColors = useMemo(() => {
    const palette = ['#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed','#0ea5e9','#ea580c','#059669','#e11d48','#22c55e','#ef4444','#9333ea']
    const map = new Map<string, string>()
    let i = 0
    for (const r of sortedRows) {
      if (r.status === 'withdrawn' || r.status === 'rejected') continue
      let gkey = `${r.day}::__${r.div}`
      const dm = groupMap.get(r.day)
      if (dm) {
        for (const [gname, set] of dm.entries()) {
          if (set.has(r.div)) { gkey = `${r.day}::${gname}`; break }
        }
      }
      if (!map.has(gkey)) {
        map.set(gkey, palette[i % palette.length])
        i++
      }
    }
    return map
  }, [sortedRows, groupMap])

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
    <div className="print-root">
      <PageHeader
        title={race?.name ?? 'Entries'}
        subtitle={
          race
            ? (() => {
                const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
                const start = race.startDate
                const end = race.endDate
                return end && end.getTime() !== start.getTime() ? `${fmt(start)} → ${fmt(end)}` : fmt(start)
              })()
            : 'Manage entries for the selected race.'
        }
        actions={
          <div className="print-hide">
            <Button
              variant="secondary"
              onClick={() => { const p = new URLSearchParams(searchParams); p.set('groups','1'); setSearchParams(p, { replace: true }); if (!groupsDay) setGroupsDay(dayOptions[0] || '') }}
              title="Open division groups"
              aria-label="Open division groups"
            >
              Div groups
            </Button>
            </div>
        }
      />
      {raceState.status === 'error' ? <ErrorBanner message={`Race: ${raceState.message}`} /> : null}
      {entriesState.status === 'error' ? <ErrorBanner message={`Entries: ${entriesState.message}`} /> : null}
      {(raceState.status === 'loading' || entriesState.status === 'loading') ? <LoadingState label="Loading entries..." /> : null}

      {entriesState.status === 'ready' && rows.length === 0 ? (
        <EmptyState
          title="No entries yet"
          description="Add the first entry for this race."
          action={raceId ? { label: 'Add entry', onClick: () => addRow() } : undefined}
        />
      ) : (
        <>
      {(clashes.length > 0 || bladeClashes.length > 0) && (
        <div className="clashes">
          {clashes.map((c) => (
            <div key={c.key} className={`clash ${c.silenced ? 'silenced' : ''}`}>
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
            <div key={c.key} className={`clash ${c.silenced ? 'silenced' : ''}`}>
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
          // Blade clash flags
          const rawBlades = (r.blades || '').trim()
          const bladeParts = rawBlades ? (rawBlades.includes('+') ? rawBlades.split('+').map(s=>s.trim()).filter(Boolean) : [rawBlades]) : []
          let hasBladeClash = false
          let bladeSilenced = false
          for (const bp of bladeParts) {
            const k = `${gkey}::${bp}`
            if (bladeClashLookup.has(k)) {
              hasBladeClash = true
              if (bladeClashLookup.get(k)) bladeSilenced = true
            }
          }
          return (
          <div
            key={r.id}
            className={`entry-card ${r.status === 'withdrawn' || r.status === 'rejected' ? r.status : ''} ${r.crewChanged ? 'changed' : ''} print-avoid-break`}
            style={(() => {
              if (r.status === 'withdrawn' || r.status === 'rejected') return undefined
              // compute group key again to fetch assigned color
              let gkey2 = `${r.day}::__${r.div}`
              const dm2 = groupMap.get(r.day)
              if (dm2) {
                for (const [gname, set] of dm2.entries()) {
                  if (set.has(r.div)) { gkey2 = `${r.day}::${gname}`; break }
                }
              }
              const c = groupColors.get(gkey2)
              return c ? { borderLeft: `4px solid ${c}` } : undefined
            })()}
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
                <div>
                  {r.blades || '-'}
                  {hasBladeClash ? (
                    <span className={`clash-icon ${bladeSilenced ? 'silenced' : 'active'}`} title={bladeSilenced ? 'Blade clash silenced' : 'Blade clash'} style={{ marginLeft: 6 }}>
                      {bladeSilenced ? '⚠️' : '🚨'}
                    </span>
                  ) : null}
                </div>
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
              <div className="cell blades">
                <span className="muted-label">Blades:</span> {r.blades || '-'}
                {hasBladeClash ? (
                  <span
                    className={`clash-icon ${bladeSilenced ? 'silenced' : 'active'}`}
                    title={bladeSilenced ? 'Blade clash silenced' : 'Blade clash'}
                    aria-label={bladeSilenced ? 'Blade clash silenced' : 'Blade clash'}
                    style={{ marginLeft: 6 }}
                  >
                    {bladeSilenced ? '⚠️' : '🚨'}
                  </span>
                ) : null}
              </div>
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
      </>
      )}
      <Modal open={open} onClose={() => { setOpen(false); setForm(null); setEditingId(null) }} title={editingId ? 'Edit entry' : 'Add entry'} footer={null}>
        {form && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!form || savingEntry) return
              try {
                setSavingEntry(true)
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
              } catch (err) {
                alert('Failed to save entry. Please try again.')
                console.error(err)
              } finally {
                setSavingEntry(false)
              }
            }}
            className="form-grid"
            onKeyDown={(e) => {
              if ((e.key === 'Enter' && (e.metaKey || e.shiftKey)) && !editingId && form) {
                e.preventDefault()
                ;(async () => {
                  try {
                    setSavingEntry(true)
                  await createEntry(form)
                  const nextDefaults: Partial<NewEntry> = { day: form.day, div: form.div, event: form.event, boat: form.boat, blades: form.blades }
                  setLastDefaults(nextDefaults)
                  setForm({ ...form, athleteNames: '', notes: '', status: 'in_progress', crewChanged: false })
                  requestAnimationFrame(() => athleteInputRef.current?.focus())
                  } catch (err) {
                    alert('Failed to add entry. Please try again.')
                    console.error(err)
                  } finally {
                    setSavingEntry(false)
                  }
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
              <Field
                id="entry-div"
                label="Div"
                value={form.div}
                onChange={(v) => setForm({ ...form, div: v })}
              />
            </div>
            <div className="form-row">
              <Field
                id="entry-event"
                label="Event"
                value={form.event}
                onChange={(v) => {
                  const next = v
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
              <Field
                id="entry-notes"
                label="Notes"
                value={form.notes}
                onChange={(v) => setForm({ ...form, notes: v })}
              />
            </div>
            <div className="form-span-2" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {!editingId ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>Tip: Shift+Enter to "Add & add another"</span> : <span />}
              <span style={{ display: 'inline-flex', gap: 8 }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={savingEntry}
                  onClick={() => { setOpen(false); searchParams.delete('add'); setSearchParams(searchParams); setForm(null); setEditingId(null) }}
                >
                  Cancel
                </Button>
                {!editingId && (
                  <Button
                    type="button"
                    disabled={savingEntry}
                    onClick={async () => {
                    if (!form) return
                      setSavingEntry(true)
                    await createEntry(form)
                    const nextDefaults: Partial<NewEntry> = { day: form.day, div: form.div, event: form.event, boat: form.boat, blades: form.blades }
                    setLastDefaults(nextDefaults)
                    setForm({ ...form, athleteNames: '', notes: '', status: 'in_progress', crewChanged: false })
                    requestAnimationFrame(() => athleteInputRef.current?.focus())
                      setSavingEntry(false)
                    }}
                  >
                    {savingEntry ? 'Saving…' : 'Add & add another'}
                  </Button>
                )}
                <Button type="submit" disabled={savingEntry}>{savingEntry ? 'Saving…' : editingId ? 'Save' : 'Add'}</Button>
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
                          <button
                            className="row-action"
                            onClick={() => {
                              if (!confirmDanger(`Delete group "${g.group}"?`)) return
                              deleteDivisionGroup(g.id)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Divisions</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                            {Array.from(uniqueDivsByDay.get(groupsDay || '') || []).map((dv) => {
                              const checked = (g.divisions || []).includes(dv)
                              const owner = divisionOwnerMap.get(dv)
                              const ownedElsewhere = !!owner && owner.groupId !== g.id
                              const disabled = ownedElsewhere && !checked
                              return (
                                <label key={dv} style={{ display: 'grid', gap: 4 }}>
                                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={(e)=> { void toggleDivisionAssignment(groupsDay, g.id, dv, e.target.checked) }}
                                    />
                                    {dv}
                                  </span>
                                  {ownedElsewhere ? (
                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                      Assigned to: {owner?.groupName || 'another group'}
                                    </span>
                                  ) : null}
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
              <Button onClick={closeGroups}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


