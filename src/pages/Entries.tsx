import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { subscribeEntries, createEntry, updateEntry } from '../data/entries'
import { subscribeBlades, type Blade } from '../data/blades'
import { subscribeBoats, type Boat } from '../data/boats'
import { getRaceById } from '../data/races'
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
        raceNumber: '',
        raceTimes: [],
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

  const sortedRows = useMemo(() => {
    const dayRank: Record<string, number> = {}
    dayOptions.forEach((d, i) => { dayRank[d] = i })
    const parseMaybeNum = (s: string) => {
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }
    const cmp = (a: Entry, b: Entry) => {
      const ar = dayRank[a.day] ?? 9999
      const br = dayRank[b.day] ?? 9999
      if (ar !== br) return ar - br
      const ad = a.div.trim(); const bd = b.div.trim()
      const adn = parseMaybeNum(ad); const bdn = parseMaybeNum(bd)
      if (adn !== null && bdn !== null && adn !== bdn) return adn - bdn
      const divCmp = ad.localeCompare(bd, undefined, { sensitivity: 'base', numeric: true })
      if (divCmp !== 0) return divCmp
      return a.event.localeCompare(b.event, undefined, { sensitivity: 'base', numeric: true })
    }
    return [...rows].sort(cmp)
  }, [rows, dayOptions])

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
      raceNumber: '',
      raceTimes: [],
      notes: '',
      status: 'in_progress',
      crewChanged: false,
    }
    setForm(blank)
    setOpen(true)
    setEditingId(null)
  }

  async function updateCell(id: string, patch: Partial<NewEntry>) {
    await updateEntry(id, patch)
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
      </div>
      <div className="entries-list">
        {sortedRows.map((r) => {
          const dayIndex = Math.max(0, dayOptions.indexOf(r.day))
          const divIndex = (() => {
            const n = Number(r.div)
            if (Number.isFinite(n)) return Math.min(5, Math.max(0, n % 6))
            return (r.div || '').toUpperCase().charCodeAt(0) % 6
          })()
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
                raceNumber: r.raceNumber || '',
                raceTimes: r.raceTimes || [],
                notes: r.notes,
                status: r.status || 'ready',
                crewChanged: r.crewChanged || false,
              }
              setForm(initial)
              setEditingId(r.id)
              setOpen(true)
            }}
          >
            <div className="entry-top">
              <span className={`badge mono day-${dayIndex}`}>{r.day || '-'}</span>
              <span className={`badge mono div-${divIndex}`}>Div {r.div || '-'}</span>
              <span className="entry-event">{r.event || '-'}</span>
              {/* Add similar button removed as requested */}
            </div>
            <div className="entry-names">{r.athleteNames || '-'}</div>
            <div className="entry-bottom">
              <span>Boat: {r.boat || '-'}</span>
              <span>Blades: {r.blades || '-'}</span>
              <span className={`status ${r.status}`}
                onClick={(e) => {
                  e.stopPropagation()
                  const cycle = ['in_progress','ready','entered','withdrawn','rejected'] as const
                  const next = cycle[(cycle.indexOf((r.status as any)) + 1) % cycle.length]
                  updateCell(r.id, { status: next as any })
                }}
                title="Click to change status"
              >{r.status.replace('_',' ')}</span>
              <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e)=>e.stopPropagation()}>
                <input type="checkbox" disabled={r.status==='withdrawn'||r.status==='rejected'} checked={r.crewChanged} onChange={(e)=>updateCell(r.id,{ crewChanged: e.target.checked })} />
                Crew changed
              </label>
            </div>
            {r.notes?.trim() ? <div className="entry-notes">{r.notes}</div> : null}
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
            <div className="form-row form-span-2">
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
            <div className="form-row">
              <label>Blades</label>
              <select value={form.blades} onChange={(e) => setForm({ ...form, blades: e.target.value })}>
                <option value="">-</option>
                {bladeOptions.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
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
    </div>
  )
}


