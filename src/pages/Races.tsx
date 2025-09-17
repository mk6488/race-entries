import { useEffect, useMemo, useState } from 'react'
import { createRace, subscribeRaces } from '../data/races'
import type { NewRace, Race } from '../models/race'
import { Modal } from '../ui/Modal'
import { Link } from 'react-router-dom'

function toInputDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromInputDateTimeLocal(s: string) { return new Date(s) }

function toInputDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromInputDate(s: string) {
  if (!s) return new Date()
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10))
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function Races() {
  const [races, setRaces] = useState<Race[]>([])
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
            return (
              <Link to="/entries" className="race-card" key={r.id}>
                <div className="race-date">{dateLabel}</div>
                <div className="race-name">{r.name}</div>
                <div className="race-details">{r.details || 'No details'}</div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}


