import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { subscribeRaces, createRace, updateRace } from '../data/races'
import type { Race, NewRace } from '../models/race'
import type { Blade, DivisionGroup, Entry, SilencedBladeClash, SilencedClash } from '../models/firestore'
import { toInputDate, fromInputDate, toInputDateTimeLocal, fromInputDateTimeLocal, formatUiDate } from '../utils/dates'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/components/Button'
import { Field } from '../ui/components/Field'
import { FormRow } from '../ui/components/FormRow'
import { PageHeader } from '../ui/components/PageHeader'
import { confirmDanger } from '../utils/confirm'
import type { Loadable } from '../models/ui'
import { LoadingState } from '../ui/components/LoadingState'
import { EmptyState } from '../ui/components/EmptyState'
import { ErrorBanner } from '../ui/components/ErrorBanner'
import { toErrorMessage } from '../utils/errors'
import { computeRaceClashSummary } from '../utils/clashes'
import { db } from '../firebase'
import { asRecord, asString, asStringArray } from '../data/firestoreMapping'
import { subscribeEntriesByRaceIds } from '../data/subscribeEntriesByRaceIds'
import { subscribeBlades } from '../data/blades'

export function Home() {
  const [racesState, setRacesState] = useState<Loadable<Race[]>>({ status: 'loading' })
  useEffect(() => {
    return subscribeRaces(
      (rows) => setRacesState({ status: 'ready', data: rows }),
      (err) => setRacesState({ status: 'error', message: toErrorMessage(err) }),
    )
  }, [])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewRace>({
    name: '',
    details: '',
    startDate: new Date(),
    endDate: null,
    broeOpens: new Date(),
    broeCloses: new Date(),
  })
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<NewRace>({
    name: '',
    details: '',
    startDate: new Date(),
    endDate: null,
    broeOpens: new Date(),
    broeCloses: new Date(),
  })
  const [creating, setCreating] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [entriesByRace, setEntriesByRace] = useState<Record<string, Entry[]>>({})
  const [groupsByRace, setGroupsByRace] = useState<Record<string, DivisionGroup[]>>({})
  const [silencesByRace, setSilencesByRace] = useState<Record<string, SilencedClash[]>>({})
  const [bladeSilencesByRace, setBladeSilencesByRace] = useState<Record<string, SilencedBladeClash[]>>({})
  const [blades, setBlades] = useState<Blade[]>([])

  const races = racesState.status === 'ready' ? racesState.data : []

  const now = new Date()
  function isAutoArchive(r: Race): boolean {
    const d = r.endDate ?? r.startDate
    const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() + 1) // day after the event
    return now >= cutoff
  }

  // Auto-archive races the day after the event if not archived yet
  useEffect(() => {
    const toArchive = races.filter(r => !r.archived && isAutoArchive(r))
    if (toArchive.length) {
      ;(async () => {
        try {
          await Promise.all(toArchive.map(r => updateRace(r.id, { archived: true })))
        } catch (err) {
          console.warn('Auto-archive failed', err)
        }
      })()
    }
  }, [races])

  const visibleRaces = races.filter(r => !r.archived && !isAutoArchive(r))
  const raceIdsLimited = useMemo(() => visibleRaces.slice(0, 30).map((r) => r.id), [visibleRaces])
  const raceIdsKey = raceIdsLimited.join('|')

  useEffect(() => {
    const unsub = subscribeBlades((rows) => setBlades(rows))
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeEntriesByRaceIds(
      raceIdsLimited,
      (entries) => {
        const map: Record<string, Entry[]> = {}
        for (const e of entries) {
          if (!map[e.raceId]) map[e.raceId] = []
          map[e.raceId].push(e)
        }
        setEntriesByRace(map)
      },
      (err) => {
        console.warn('Failed to subscribe entries for clashes', err)
      },
    )
    return () => unsub()
  }, [raceIdsKey, raceIdsLimited])

  useEffect(() => {
    if (!raceIdsLimited.length) {
      setGroupsByRace({})
      setSilencesByRace({})
      setBladeSilencesByRace({})
      return
    }

    const chunks: string[][] = []
    for (let i = 0; i < raceIdsLimited.length; i += 10) {
      chunks.push(raceIdsLimited.slice(i, i + 10))
    }

    const makeSub = <T,>(
      collectionName: string,
      mapDoc: (data: Record<string, unknown>, id: string) => T | null,
      setter: (val: Record<string, T[]>) => void,
    ) => {
      const chunkData = new Map<number, T[]>()
      const unsubs = chunks.map((ids, idx) => {
        const q = query(collection(db, collectionName), where('raceId', 'in', ids))
        return onSnapshot(
          q,
          (snap) => {
            const rows = snap.docs
              .map((d) => mapDoc(asRecord(d.data()), d.id))
              .filter(Boolean) as T[]
            chunkData.set(idx, rows)
            const merged: Record<string, T[]> = {}
            for (const arr of chunkData.values()) {
              for (const item of arr) {
                const raceId = (item as any).raceId as string | undefined
                if (!raceId) continue
                if (!merged[raceId]) merged[raceId] = []
                merged[raceId].push(item)
              }
            }
            setter(merged)
          },
          (err) => {
            console.warn(`Failed to subscribe ${collectionName}`, err)
          },
        )
      })
      return () => unsubs.forEach((u) => u())
    }

    const unsubGroups = makeSub<DivisionGroup>(
      'divisionGroups',
      (rec, id) => ({
        id,
        raceId: asString(rec.raceId, ''),
        day: asString(rec.day, ''),
        group: asString(rec.group, ''),
        divisions: asStringArray(rec.divisions, []),
      }),
      setGroupsByRace,
    )

    const unsubSilences = makeSub<SilencedClash>(
      'silencedClashes',
      (rec, id) => ({
        id,
        raceId: asString(rec.raceId, ''),
        day: asString(rec.day, ''),
        group: asString(rec.group, ''),
        boat: asString(rec.boat, ''),
      }),
      setSilencesByRace,
    )

    const unsubBladeSilences = makeSub<SilencedBladeClash>(
      'silencedBladeClashes',
      (rec, id) => ({
        id,
        raceId: asString(rec.raceId, ''),
        day: asString(rec.day, ''),
        group: asString(rec.group, ''),
        blade: asString(rec.blade, ''),
      }),
      setBladeSilencesByRace,
    )

    return () => {
      unsubGroups()
      unsubSilences()
      unsubBladeSilences()
    }
  }, [raceIdsKey, raceIdsLimited])

  const clashMap = useMemo(() => {
    const out: Record<string, boolean> = {}
    for (const id of raceIdsLimited) {
      const summary = computeRaceClashSummary({
        entries: entriesByRace[id] || [],
        divisionGroups: groupsByRace[id] || [],
        silences: silencesByRace[id] || [],
        bladeSilences: bladeSilencesByRace[id] || [],
        blades,
        raceId: id,
      })
      if (summary.hasAnyClash) out[id] = true
    }
    return out
  }, [raceIdsLimited, entriesByRace, groupsByRace, silencesByRace, bladeSilencesByRace, blades])

  function getRaceStatus(r: Race, now: Date) {
    const opens = r.broeOpens
    const closes = r.broeCloses
    const msInDay = 24 * 60 * 60 * 1000
    const openingSoonStart = new Date(opens.getTime() - 3 * msInDay)
    const closingSoonStart = new Date(closes.getTime() - 3 * msInDay)
    if (now < openingSoonStart) return { kind: 'opening_later' as const }
    if (now >= openingSoonStart && now < opens) return { kind: 'opening_soon' as const, target: opens }
    if (now >= opens && now < closingSoonStart) return { kind: 'open' as const }
    if (now >= closingSoonStart && now < closes) return { kind: 'closing_soon' as const, target: closes }
    return { kind: 'closed' as const }
  }

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  function fmtCountdown(target: Date, now: Date) {
    const diff = Math.max(0, target.getTime() - now.getTime())
    const s = Math.floor(diff / 1000)
    const days = Math.floor(s / 86400)
    const hrs = Math.floor((s % 86400) / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    if (days > 0) return `${days}d ${hrs}h ${mins}m`
    return `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`
  }

  return (
    <div className="print-root">
      <div className="card" style={{ marginTop: 4 }}>
        <PageHeader
          title="Select a race"
          subtitle="Create or edit races to manage entries."
          actions={
            <div className="print-hide" style={{ display: 'inline-flex', gap: 8 }}>
              <Button onClick={() => setOpen(true)}>New race</Button>
            </div>
          }
        />
        {racesState.status === 'error' ? <ErrorBanner message={racesState.message} /> : null}
        {racesState.status === 'loading' ? (
          <LoadingState label="Loading races..." />
        ) : racesState.status === 'ready' && visibleRaces.length === 0 ? (
          <EmptyState
            title="No races yet"
            description="Create your first race to start managing entries."
            action={{ label: 'New race', onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="race-grid">
            {visibleRaces.map((r) => {
              const start = formatUiDate(r.startDate)
              const end = r.endDate ? formatUiDate(r.endDate) : null
              const dateLabel = end && end !== start ? `${start} → ${end}` : start
              const status = getRaceStatus(r, new Date())
              return (
                <div className="race-card" key={r.id}>
                  <div className="race-card-header">
                    <Link to={`/entries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="race-date">{dateLabel}</div>
                      <div className="race-name">
                        {r.name}
                        {clashMap[r.id] ? (
                          <span
                            className="clash-icon active"
                            title="Equipment clashes detected"
                            aria-label="Equipment clashes detected"
                            style={{ marginLeft: 6 }}
                          >
                            🚨
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  <div className="race-actions print-hide">
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditId(r.id)
                        setEditForm({
                          name: r.name,
                          details: r.details,
                          startDate: r.startDate,
                          endDate: r.endDate ?? null,
                          broeOpens: r.broeOpens,
                          broeCloses: r.broeCloses,
                        })
                        setEditOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={archivingId === r.id}
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirmDanger(`Archive race "${r.name}"?`)) return
                        try {
                          setArchivingId(r.id)
                          await updateRace(r.id, { archived: true })
                        } catch (err) {
                          alert('Failed to archive race. Please try again.')
                          console.error(err)
                        } finally {
                          setArchivingId(null)
                        }
                      }}
                    >
                      {archivingId === r.id ? 'Archiving…' : 'Archive race'}
                    </Button>
                    </div>
                  </div>
                  <Link to={`/entries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="race-details">{r.details || 'No details'}</div>
                  </Link>
                  <div>
                    {status.kind === 'open' && (
                      <span className="race-status open">OPEN</span>
                    )}
                    {status.kind === 'closed' && (
                      <span className="race-status closed">CLOSED</span>
                    )}
                    {status.kind === 'opening_soon' && (
                      <span className="race-status opening">OPENING SOON <span className="countdown">{fmtCountdown(status.target, new Date())}</span></span>
                    )}
                    {status.kind === 'closing_soon' && (
                      <span className="race-status closing">CLOSING SOON <span className="countdown">{fmtCountdown(status.target, new Date())}</span></span>
                    )}
                  </div>
                  {/* Mobile-bottom actions */}
                  <div className="race-actions-bottom print-hide">
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditId(r.id)
                        setEditForm({
                          name: r.name,
                          details: r.details,
                          startDate: r.startDate,
                          endDate: r.endDate ?? null,
                          broeOpens: r.broeOpens,
                          broeCloses: r.broeCloses,
                        })
                        setEditOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={archivingId === r.id}
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirmDanger(`Archive race "${r.name}"?`)) return
                        try {
                          setArchivingId(r.id)
                          await updateRace(r.id, { archived: true })
                        } catch (err) {
                          alert('Failed to archive race. Please try again.')
                          console.error(err)
                        } finally {
                          setArchivingId(null)
                        }
                      }}
                    >
                      {archivingId === r.id ? 'Archiving…' : 'Archive race'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="card-footer print-hide">
          <div className="meta">© 2025 Designed by Mike Katholnig</div>
          <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <Link to="/archive" className="text-link">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 11h16M6 7h12M8 15h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            archive
          </Link>
          <Link to="/blades" className="text-link">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 11h16M6 7h12M8 15h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            blades
          </Link>
          <Link to="/boats" className="text-link">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 11h16M6 7h12M8 15h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            boats
          </Link>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create race" footer={null}>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!form.name.trim() || creating) return
            try {
              setCreating(true)
              await createRace(form)
              setForm({ ...form, name: '', details: '' })
              setOpen(false)
            } catch (err) {
              alert('Failed to create race. Please try again.')
              console.error(err)
            } finally {
              setCreating(false)
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <Field
            id="race-name"
            label="Name"
            placeholder="e.g. Head of the River"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <Field
            id="race-details"
            label="Details"
            as="textarea"
            placeholder="Add notes or description"
            value={form.details}
            onChange={(v) => setForm({ ...form, details: v })}
          />
          <FormRow columns={2}>
            <Field
              id="race-start"
              label="Start date"
              type="date"
              value={toInputDate(form.startDate)}
              onChange={(v) => setForm({ ...form, startDate: fromInputDate(v) })}
            />
            <Field
              id="race-end"
              label="End date"
              type="date"
              value={form.endDate ? toInputDate(form.endDate) : ''}
              onChange={(v) => setForm({ ...form, endDate: v ? fromInputDate(v) : null })}
            />
          </FormRow>
          <FormRow columns={2}>
            <Field
              id="race-opens"
              label="Entries open"
              type="datetime-local"
              value={toInputDateTimeLocal(form.broeOpens)}
              onChange={(v) => setForm({ ...form, broeOpens: fromInputDateTimeLocal(v) })}
            />
            <Field
              id="race-closes"
              label="Entries close"
              type="datetime-local"
              value={toInputDateTimeLocal(form.broeCloses)}
              onChange={(v) => setForm({ ...form, broeCloses: fromInputDateTimeLocal(v) })}
            />
          </FormRow>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={creating}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create race'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit race" footer={null}>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!editId || !editForm.name.trim() || savingEdit) return
            try {
              setSavingEdit(true)
              await updateRace(editId, editForm)
              setEditOpen(false)
              setEditId(null)
            } catch (err) {
              alert('Failed to update race. Please try again.')
              console.error(err)
            } finally {
              setSavingEdit(false)
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <Field
            id="edit-race-name"
            label="Name"
            value={editForm.name}
            onChange={(v) => setEditForm({ ...editForm, name: v })}
            required
          />
          <Field
            id="edit-race-details"
            label="Details"
            as="textarea"
            value={editForm.details}
            onChange={(v) => setEditForm({ ...editForm, details: v })}
          />
          <FormRow columns={2}>
            <Field
              id="edit-race-start"
              label="Start date"
              type="date"
              value={toInputDate(editForm.startDate)}
              onChange={(v) => setEditForm({ ...editForm, startDate: fromInputDate(v) })}
            />
            <Field
              id="edit-race-end"
              label="End date"
              type="date"
              value={editForm.endDate ? toInputDate(editForm.endDate) : ''}
              onChange={(v) => setEditForm({ ...editForm, endDate: v ? fromInputDate(v) : null })}
            />
          </FormRow>
          <FormRow columns={2}>
            <Field
              id="edit-race-opens"
              label="Entries open"
              type="datetime-local"
              value={toInputDateTimeLocal(editForm.broeOpens)}
              onChange={(v) => setEditForm({ ...editForm, broeOpens: fromInputDateTimeLocal(v) })}
            />
            <Field
              id="edit-race-closes"
              label="Entries close"
              type="datetime-local"
              value={toInputDateTimeLocal(editForm.broeCloses)}
              onChange={(v) => setEditForm({ ...editForm, broeCloses: fromInputDateTimeLocal(v) })}
            />
          </FormRow>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={savingEdit}>Cancel</Button>
            <Button type="submit" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}


