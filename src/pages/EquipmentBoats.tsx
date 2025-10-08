import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

  const typeBuckets = useMemo(() => {
    const buckets: Record<string, string[]> = { '1x': [], '2x/-': [], '4x/-': [], '4+': [], '8+': [] }
    for (const r of filtered) {
      const t = (r.type || '').toLowerCase()
      if (t === '1x') buckets['1x'].push(r.name || '')
      else if (t === '2x' || t === '2-') buckets['2x/-'].push(r.name || '')
      else if (t === '4x' || t === '4-') buckets['4x/-'].push(r.name || '')
      else if (t === '4+') buckets['4+'].push(r.name || '')
      else if (t === '8x+' || t === '8+') buckets['8+'].push(r.name || '')
    }
    for (const k of Object.keys(buckets)) buckets[k].sort((a,b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))
    return buckets
  }, [filtered])

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link to="/" className="secondary-btn">Back</Link>
      </div>
      <div className="card" style={{ marginTop: 4 }}>
        <h1 style={{ margin: 0 }}>Boats</h1>
        <div className="boats-type-grid desktop-only" style={{ marginTop: 12 }}>
          {['1x','2x/-','4x/-','4+','8+'].map((label) => (
            <div key={label} className="type-col">
              <div className="section-title" style={{ marginBottom: 6 }}>{label}</div>
              <div className="type-list">
                {typeBuckets[label].length ? typeBuckets[label].map((n) => (
                  <div key={n} className="type-item">{n}</div>
                )) : <div className="type-empty">None</div>}
              </div>
            </div>
          ))}
        </div>
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


