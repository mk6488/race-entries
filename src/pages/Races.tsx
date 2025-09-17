import { useEffect, useMemo, useState } from 'react'
import { createRace, subscribeRaces } from '../data/races'
import type { NewRace, Race } from '../models/race'

function toInputDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromInputDateTimeLocal(s: string) { return new Date(s) }

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

  useEffect(() => {
    const unsub = subscribeRaces(setRaces)
    return () => unsub()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    await createRace(form)
    setForm({ ...form, name: '', details: '' })
  }

  return (
    <div>
      <h1>Races</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <textarea
          placeholder="Details"
          value={form.details}
          onChange={(e) => setForm({ ...form, details: e.target.value })}
        />
        <label>
          Start
          <input type="datetime-local" value={toInputDateTimeLocal(form.startDate)} onChange={(e) => setForm({ ...form, startDate: fromInputDateTimeLocal(e.target.value) })} />
        </label>
        <label>
          End (optional)
          <input type="datetime-local" value={form.endDate ? toInputDateTimeLocal(form.endDate) : ''} onChange={(e) => setForm({ ...form, endDate: e.target.value ? fromInputDateTimeLocal(e.target.value) : null })} />
        </label>
        <label>
          BROE opens
          <input type="datetime-local" value={toInputDateTimeLocal(form.broeOpens)} onChange={(e) => setForm({ ...form, broeOpens: fromInputDateTimeLocal(e.target.value) })} />
        </label>
        <label>
          BROE closes
          <input type="datetime-local" value={toInputDateTimeLocal(form.broeCloses)} onChange={(e) => setForm({ ...form, broeCloses: fromInputDateTimeLocal(e.target.value) })} />
        </label>
        <button type="submit">Create race</button>
      </form>

      <h2 style={{ marginTop: 24 }}>Existing</h2>
      <ul>
        {races.map((r) => (
          <li key={r.id}>
            <strong>{r.name}</strong> — {r.details || 'No details'}
          </li>
        ))}
      </ul>
    </div>
  )
}


