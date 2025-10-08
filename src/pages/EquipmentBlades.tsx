import { useEffect, useMemo, useState } from 'react'
import { subscribeBlades, createBlade, updateBlade, deleteBlade, type Blade } from '../data/blades'

export function EquipmentBlades() {
  const [rows, setRows] = useState<Blade[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const unsub = subscribeBlades(setRows)
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => (r.name||'').toLowerCase().includes(q))
  }, [rows, filter])

  return (
    <div>
      <div className="card" style={{ marginTop: 4 }}>
        <h1 style={{ margin: 0 }}>Blades</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input placeholder="Filter" value={filter} onChange={(e)=> setFilter(e.target.value)} style={{ maxWidth: 220 }} />
          <input placeholder="Set name" value={name} onChange={(e)=> setName(e.target.value)} />
          <input placeholder="Amount" inputMode="numeric" value={amount} onChange={(e)=> setAmount(e.target.value)} style={{ width: 100 }} />
          <button onClick={async ()=>{
            if (!name.trim()) return
            const amt = Math.max(0, Number(amount) || 0)
            await createBlade({ name: name.trim(), amount: amt, active: true })
            setName(''); setAmount('')
          }}>Add</button>
        </div>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Set</th>
                <th style={{ width: 120 }}>Amount</th>
                <th style={{ width: 120 }}>Active</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input value={r.name} onChange={(e)=> updateBlade(r.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" min={0} value={(r as any).amount ?? 0}
                      onChange={(e)=> updateBlade(r.id, { amount: Math.max(0, Number(e.target.value)||0) })} />
                  </td>
                  <td>
                    <input type="checkbox" checked={!!r.active} onChange={(e)=> updateBlade(r.id, { active: e.target.checked })} />
                  </td>
                  <td>
                    <button className="row-action" onClick={async ()=> { if (confirm('Delete blades set?')) await deleteBlade(r.id) }}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No blades</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


