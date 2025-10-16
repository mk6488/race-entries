import { useEffect, useMemo, useState } from 'react'
import { createRace, subscribeRaces } from '../data/races'
import type { NewRace, Race } from '../models/race'
import { Modal } from '../ui/Modal'
import { Link } from 'react-router-dom'
import { toInputDate, fromInputDate, toInputDateTimeLocal, fromInputDateTimeLocal } from '../utils/dates'

export function Races() {
  const [races, setRaces] = useState<Race[]>([])
  const [, setTick] = useState(0)
  const [form, setForm] = useState<NewRace>({
    name: '',
    details: '',
    startDate: new Date(),
    endDate: null,
    broeOpens: new Date(),
    broeCloses: new Date(),
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unsub = subscribeRaces(setRaces)
    return () => unsub()
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    await createRace(form)
    setForm({ ...form, name: '', details: '' })
    setOpen(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Races</h1>
        <button onClick={() => setOpen(true)}>New race</button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create race" footer={null}>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Name</label>
            <input
              placeholder="e.g. Head of the River"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Details</label>
            <textarea
              placeholder="Add notes or description"
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              rows={4}
            />
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Start date</label>
              <input type="date" value={toInputDate(form.startDate)} onChange={(e) => setForm({ ...form, startDate: fromInputDate(e.target.value) })} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>End date (optional)</label>
              <input type="date" value={form.endDate ? toInputDate(form.endDate) : ''} onChange={(e) => setForm({ ...form, endDate: e.target.value ? fromInputDate(e.target.value) : null })} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>BROE opens</label>
              <input type="datetime-local" value={toInputDateTimeLocal(form.broeOpens)} onChange={(e) => setForm({ ...form, broeOpens: fromInputDateTimeLocal(e.target.value) })} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>BROE closes</label>
              <input type="datetime-local" value={toInputDateTimeLocal(form.broeCloses)} onChange={(e) => setForm({ ...form, broeCloses: fromInputDateTimeLocal(e.target.value) })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>Cancel</button>
            <button type="submit">Create race</button>
          </div>
        </form>
      </Modal>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Existing</h2>
        <div className="race-grid">
          {races.map((r) => {
            const start = toInputDate(r.startDate)
            const end = r.endDate ? toInputDate(r.endDate) : null
            const dateLabel = end && end !== start ? `${start} → ${end}` : start
            const status = getRaceStatus(r, new Date())
            return (
              <Link to={`/entries/${r.id}`} className="race-card" key={r.id}>
                <div className="race-date">{dateLabel}</div>
                <div className="race-name">{r.name}</div>
                <div className="race-details">{r.details || 'No details'}</div>
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
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}


