import { useEffect, useState } from 'react'
import { subscribeRaces, createRace, updateRace } from '../data/races'
import type { Race, NewRace } from '../models/race'
import { Link } from 'react-router-dom'
import { toInputDate, fromInputDate, toInputDateTimeLocal, fromInputDateTimeLocal } from '../utils/dates'
import { Modal } from '../ui/Modal'

export function Home() {
  const [races, setRaces] = useState<Race[]>([])
  useEffect(() => subscribeRaces(setRaces), [])
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

  return (
    <div>
      <div className="card" style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h1 style={{ marginTop: 0, marginBottom: 0 }}>Select a race</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="primary-btn" onClick={() => setOpen(true)}>New race</button>
          </div>
        </div>
        <div className="race-grid">
          {visibleRaces.map((r) => {
            const start = toInputDate(r.startDate)
            const end = r.endDate ? toInputDate(r.endDate) : null
            const dateLabel = end && end !== start ? `${start} → ${end}` : start
            return (
              <div className="race-card" key={r.id}>
                <div className="race-card-header">
                  <Link to={`/entries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="race-date">{dateLabel}</div>
                    <div className="race-name">{r.name}</div>
                  </Link>
                  <div className="race-actions">
                    <button
                      className="secondary-btn"
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
                    </button>
                    <button
                      className="secondary-btn"
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await updateRace(r.id, { archived: true })
                        } catch (err) {
                          alert('Failed to archive race. Please try again.')
                          console.error(err)
                        }
                      }}
                    >
                      Archive now
                    </button>
                  </div>
                </div>
                <Link to={`/entries/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="race-details">{r.details || 'No details'}</div>
                </Link>
              </div>
            )
          })}
        </div>
        <div className="card-footer">
          <Link to="/archive" className="text-link">go to archive</Link>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create race" footer={null}>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!form.name.trim()) return
            try {
              await createRace(form)
              setForm({ ...form, name: '', details: '' })
              setOpen(false)
            } catch (err) {
              alert('Failed to create race. Please try again.')
              console.error(err)
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Start date</label>
              <input
                type="date"
                value={toInputDate(form.startDate)}
                onChange={(e) => setForm({ ...form, startDate: fromInputDate(e.target.value) })}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>End date</label>
              <input
                type="date"
                value={form.endDate ? toInputDate(form.endDate) : ''}
                onChange={(e) => setForm({ ...form, endDate: e.target.value ? fromInputDate(e.target.value) : null })}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Entries open</label>
              <input
                type="datetime-local"
                value={toInputDateTimeLocal(form.broeOpens)}
                onChange={(e) => setForm({ ...form, broeOpens: fromInputDateTimeLocal(e.target.value) })}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Entries close</label>
              <input
                type="datetime-local"
                value={toInputDateTimeLocal(form.broeCloses)}
                onChange={(e) => setForm({ ...form, broeCloses: fromInputDateTimeLocal(e.target.value) })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="primary-btn">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit race" footer={null}>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!editId) return
            if (!editForm.name.trim()) return
            try {
              await updateRace(editId, editForm)
              setEditOpen(false)
              setEditId(null)
            } catch (err) {
              alert('Failed to update race. Please try again.')
              console.error(err)
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Details</label>
            <textarea
              value={editForm.details}
              onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
              rows={4}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Start date</label>
              <input
                type="date"
                value={toInputDate(editForm.startDate)}
                onChange={(e) => setEditForm({ ...editForm, startDate: fromInputDate(e.target.value) })}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>End date</label>
              <input
                type="date"
                value={editForm.endDate ? toInputDate(editForm.endDate) : ''}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value ? fromInputDate(e.target.value) : null })}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Entries open</label>
              <input
                type="datetime-local"
                value={toInputDateTimeLocal(editForm.broeOpens)}
                onChange={(e) => setEditForm({ ...editForm, broeOpens: fromInputDateTimeLocal(e.target.value) })}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Entries close</label>
              <input
                type="datetime-local"
                value={toInputDateTimeLocal(editForm.broeCloses)}
                onChange={(e) => setEditForm({ ...editForm, broeCloses: fromInputDateTimeLocal(e.target.value) })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="secondary-btn" onClick={() => setEditOpen(false)}>Cancel</button>
            <button type="submit" className="primary-btn">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}


