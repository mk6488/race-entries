import { useEffect, useMemo, useState } from 'react'
import { subscribeBoats, createBoat, updateBoat, deleteBoat, type Boat } from '../data/boats'

export function EquipmentBoats() {
  const [rows, setRows] = useState<Boat[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const unsub = subscribeBoats(setRows)
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => (r.name||'').toLowerCase().includes(q) || (r.type||'').toLowerCase().includes(q))
  }, [rows, filter])

  return (
    <div>
      <div className="card" style={{ marginTop: 4 }}>
        <h1 style={{ margin: 0 }}>Boats</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input placeholder="Filter" value={filter} onChange={(e)=> setFilter(e.target.value)} style={{ maxWidth: 220 }} />
          <input placeholder="Name" value={name} onChange={(e)=> setName(e.target.value)} />
          <input placeholder="Type (e.g. 4x, 2-)" value={type} onChange={(e)=> setType(e.target.value)} />
          <button onClick={async ()=>{
            if (!name.trim() || !type.trim()) return
            await createBoat({ name: name.trim(), type: type.trim(), active: true })
            setName(''); setType('')
          }}>Add</button>
        </div>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Name</th>
                <th style={{ width: 140 }}>Type</th>
                <th style={{ width: 120 }}>Active</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input value={r.name} onChange={(e)=> updateBoat(r.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input value={r.type} onChange={(e)=> updateBoat(r.id, { type: e.target.value })} />
                  </td>
                  <td>
                    <input type="checkbox" checked={!!r.active} onChange={(e)=> updateBoat(r.id, { active: e.target.checked })} />
                  </td>
                  <td>
                    <button className="row-action" onClick={async ()=> { if (confirm('Delete boat?')) await deleteBoat(r.id) }}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No boats</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


