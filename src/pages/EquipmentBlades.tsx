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
    const list = q ? rows.filter(r => (r.name||'').toLowerCase().includes(q)) : rows
    const codeRank = (c?: Blade['lengthCode']) => c === 'NA' || !c ? 999 : Number(c)
    return [...list].sort((a,b) => {
      const ca = codeRank(a.lengthCode); const cb = codeRank(b.lengthCode)
      if (ca !== cb) return ca - cb
      return (a.name||'').localeCompare(b.name||'', undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [rows, filter])

  function codeToPreset(code: Blade['lengthCode']) {
    switch (code) {
      case '1': return { bladeLength: 285, inboard: 88, span: 159, color: '#bfdbfe' } // light blue
      case '2': return { bladeLength: 286, inboard: 88, span: 159, color: '#fde68a' } // yellow
      case '3': return { bladeLength: 287, inboard: 88, span: 159, color: '#86efac' } // green
      case '4': return { bladeLength: 288, inboard: 88, span: 159, color: '#93c5fd' } // dark blue-ish
      case '5': return { bladeLength: 289, inboard: 88, span: 159, color: '#e5e7eb' } // gray
      case 'NA':
      default: return { bladeLength: null, inboard: null, span: null, color: '#e9d5ff' } // purple
    }
  }

  return (
    <div>
      <div className="card" style={{ marginTop: 4 }}>
        <h1 style={{ margin: 0 }}>Blades</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input placeholder="Filter" value={filter} onChange={(e)=> setFilter(e.target.value)} style={{ maxWidth: 220 }} />
          <input placeholder="Set name" value={name} onChange={(e)=> setName(e.target.value)} />
          <input placeholder="Amount" inputMode="numeric" value={amount} onChange={(e)=> setAmount(e.target.value)} style={{ width: 100 }} />
          <select defaultValue="NA" onChange={(e)=>{ /* optional default for new rows */ }}>
            <option value="NA">N/A</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          <button onClick={async ()=>{
            if (!name.trim()) return
            const amt = Math.max(0, Number(amount) || 0)
            await createBlade({ name: name.trim(), amount: amt, active: true, lengthCode: 'NA' })
            setName(''); setAmount('')
          }}>Add</button>
        </div>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Set</th>
                <th style={{ width: 120 }}>Gearing</th>
                <th style={{ width: 120 }}>Length</th>
                <th style={{ width: 120 }}>Inboard</th>
                <th style={{ width: 120 }}>Span</th>
                <th style={{ width: 120 }}>Amount</th>
                <th style={{ width: 120 }}>Active</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ background: codeToPreset(r.lengthCode as any).color }}>
                    <input value={r.name} onChange={(e)=> updateBlade(r.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <select value={r.lengthCode || 'NA'} onChange={(e)=> {
                      const code = (e.target.value || 'NA') as Blade['lengthCode']
                      const p = codeToPreset(code)
                      updateBlade(r.id, { lengthCode: code, bladeLength: p.bladeLength, inboard: p.inboard, span: p.span })
                    }}>
                      <option value="NA">N/A</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </td>
                  <td>
                    <input type="number" min={0} value={(r as any).bladeLength ?? ''} onChange={(e)=> updateBlade(r.id, { bladeLength: e.target.value === '' ? null : Math.max(0, Number(e.target.value)||0) })} />
                  </td>
                  <td>
                    <input type="number" min={0} value={(r as any).inboard ?? ''} onChange={(e)=> updateBlade(r.id, { inboard: e.target.value === '' ? null : Math.max(0, Number(e.target.value)||0) })} />
                  </td>
                  <td>
                    <input type="number" min={0} value={(r as any).span ?? ''} onChange={(e)=> updateBlade(r.id, { span: e.target.value === '' ? null : Math.max(0, Number(e.target.value)||0) })} />
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


