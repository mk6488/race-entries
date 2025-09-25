import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subscribeEntries } from '../data/entries'
import type { Entry } from '../models/entry'
import { getRaceById } from '../data/races'
import type { Race } from '../models/race'

type TrailerMode = 'small' | 'big' | 'both'

type BoardState = Record<string, string[]> // cellId -> boats

function createLayout(mode: 'small' | 'big') {
  // Return grid spec and ordered cell ids. Last id is the bottom long bay.
  if (mode === 'small') {
    return {
      columns: 3,
      rows: 3,
      cellIds: [
        's-0-0','s-1-0','s-2-0',
        's-0-1','s-1-1','s-2-1',
        's-0-2','s-1-2','s-2-2',
        's-base',
      ],
    }
  }
  return {
    columns: 4,
    rows: 4,
    cellIds: [
      'b-0-0','b-1-0','b-2-0','b-3-0',
      'b-0-1','b-1-1','b-2-1','b-3-1',
      'b-0-2','b-1-2','b-2-2','b-3-2',
      'b-0-3','b-1-3','b-2-3','b-3-3',
      'b-base',
    ],
  }
}

export function Trailer() {
  const { raceId } = useParams()
  const [race, setRace] = useState<Race | null>(null)
  const [rows, setRows] = useState<Entry[]>([])
  const [mode, setMode] = useState<TrailerMode>('small')

  // Load entries
  useEffect(() => {
    if (!raceId) return
    return subscribeEntries(raceId, setRows)
  }, [raceId])

  // Load race
  useEffect(() => {
    if (!raceId) return
    ;(async () => setRace(await getRaceById(raceId)))()
  }, [raceId])

  // Source list (boats needing allocation)
  const boats = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.status !== 'entered') continue
      const name = (r.boat || '').trim()
      if (name) set.add(name)
    }
    return Array.from(set).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }, [rows])

  // Board states
  const [smallBoard, setSmallBoard] = useState<BoardState>({})
  const [bigBoard, setBigBoard] = useState<BoardState>({})
  const [unassigned, setUnassigned] = useState<string[]>([])

  // Initialize/persist
  useEffect(() => {
    if (!raceId) return
    try {
      const a = localStorage.getItem(`trailer:${raceId}:unassigned`)
      setUnassigned(a ? JSON.parse(a) : [])
    } catch {}
    try {
      const s = localStorage.getItem(`trailer:${raceId}:small`)
      setSmallBoard(s ? JSON.parse(s) : {})
    } catch {}
    try {
      const b = localStorage.getItem(`trailer:${raceId}:big`)
      setBigBoard(b ? JSON.parse(b) : {})
    } catch {}
  }, [raceId])

  useEffect(() => {
    if (!raceId) return
    try { localStorage.setItem(`trailer:${raceId}:unassigned`, JSON.stringify(unassigned)) } catch {}
  }, [raceId, unassigned])
  useEffect(() => {
    if (!raceId) return
    try { localStorage.setItem(`trailer:${raceId}:small`, JSON.stringify(smallBoard)) } catch {}
  }, [raceId, smallBoard])
  useEffect(() => {
    if (!raceId) return
    try { localStorage.setItem(`trailer:${raceId}:big`, JSON.stringify(bigBoard)) } catch {}
  }, [raceId, bigBoard])

  // Ensure newly entered boats appear in unassigned if not already placed
  useEffect(() => {
    const placed = new Set<string>()
    const collect = (board: BoardState) => Object.values(board).forEach(list => list.forEach(x => placed.add(x)))
    collect(smallBoard); collect(bigBoard)
    const list = boats.filter(b => !placed.has(b) && !unassigned.includes(b))
    if (list.length) setUnassigned(prev => [...prev, ...list])
  }, [boats])

  function removeFromAll(boat: string) {
    setUnassigned(prev => prev.filter(x => x !== boat))
    setSmallBoard(prev => {
      const next: BoardState = {}
      for (const [k, v] of Object.entries(prev)) next[k] = v.filter(x => x !== boat)
      return next
    })
    setBigBoard(prev => {
      const next: BoardState = {}
      for (const [k, v] of Object.entries(prev)) next[k] = v.filter(x => x !== boat)
      return next
    })
  }

  function onDragStart(e: React.DragEvent, boat: string, from: string) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ boat, from }))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(targetId: string) {
    return (e: React.DragEvent) => {
      e.preventDefault()
      const data = e.dataTransfer.getData('text/plain')
      if (!data) return
      const { boat, from } = JSON.parse(data) as { boat: string; from: string }
      if (!boat) return
      // Remove from every place
      removeFromAll(boat)
      // Add to target
      if (targetId === 'unassigned') {
        setUnassigned(prev => [...prev, boat])
      } else if (targetId.startsWith('s-')) {
        setSmallBoard(prev => ({ ...prev, [targetId]: [...(prev[targetId]||[]), boat] }))
      } else if (targetId.startsWith('b-')) {
        setBigBoard(prev => ({ ...prev, [targetId]: [...(prev[targetId]||[]), boat] }))
      }
    }
  }

  const small = createLayout('small')
  const big = createLayout('big')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{race?.name ?? 'Trailer'}</h1>
          {race ? <div style={{ color: 'var(--muted)', fontSize: 14 }}>Plan trailer loads for entered boats</div> : null}
        </div>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <label className="section-title" style={{ margin: 0 }}>Trailers</label>
          <select value={mode} onChange={e=> setMode(e.target.value as TrailerMode)}>
            <option value="small">Small only</option>
            <option value="big">Big only</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      <div className="trailer-layout">
        {/* Unassigned list */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Unassigned boats</div>
          <div className="unassigned" onDragOver={(e)=> e.preventDefault()} onDrop={handleDrop('unassigned')}>
            {unassigned.map((boat) => (
              <div
                key={boat}
                className="draggable"
                draggable
                onDragStart={(e)=> onDragStart(e, boat, 'unassigned')}
                title="Drag to a trailer cell"
              >{boat}</div>
            ))}
            {unassigned.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>All boats are placed</div> : null}
          </div>
        </div>

        {/* Small trailer */}
        {(mode === 'small' || mode === 'both') && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Small trailer</div>
            <div className="trailer-grid" style={{ gridTemplateColumns: `repeat(${small.columns}, 1fr)` }}>
              {small.cellIds.slice(0, small.columns*small.rows).map((id) => (
                <div key={id} className="trailer-cell" onDragOver={(e)=> e.preventDefault()} onDrop={handleDrop(id)}>
                  {(smallBoard[id]||[]).map((b) => (
                    <div key={b} className="draggable" draggable onDragStart={(e)=> onDragStart(e, b, id)}>{b}</div>
                  ))}
                </div>
              ))}
              {/* Bottom bay spanning */}
              <div className="trailer-cell base" style={{ gridColumn: `1 / span ${small.columns}` }} onDragOver={(e)=> e.preventDefault()} onDrop={handleDrop('s-base')}>
                {(smallBoard['s-base']||[]).map((b) => (
                  <div key={b} className="draggable" draggable onDragStart={(e)=> onDragStart(e, b, 's-base')}>{b}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Big trailer */}
        {(mode === 'big' || mode === 'both') && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Big trailer</div>
            <div className="trailer-grid" style={{ gridTemplateColumns: `repeat(${big.columns}, 1fr)` }}>
              {big.cellIds.slice(0, big.columns*big.rows).map((id) => (
                <div key={id} className="trailer-cell" onDragOver={(e)=> e.preventDefault()} onDrop={handleDrop(id)}>
                  {(bigBoard[id]||[]).map((b) => (
                    <div key={b} className="draggable" draggable onDragStart={(e)=> onDragStart(e, b, id)}>{b}</div>
                  ))}
                </div>
              ))}
              {/* Bottom bay spanning */}
              <div className="trailer-cell base" style={{ gridColumn: `1 / span ${big.columns}` }} onDragOver={(e)=> e.preventDefault()} onDrop={handleDrop('b-base')}>
                {(bigBoard['b-base']||[]).map((b) => (
                  <div key={b} className="draggable" draggable onDragStart={(e)=> onDragStart(e, b, 'b-base')}>{b}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


