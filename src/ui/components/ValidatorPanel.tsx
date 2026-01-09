import { useState } from 'react'
import type { ValidationResult } from '../../data/scanCollections'
import { runValidation } from '../../data/scanCollections'
import { toErrorMessage } from '../../utils/errors'
import { trace } from '../../utils/trace'
import { generateRepairPlaybook, toJson, toMarkdown } from '../../utils/repairPlaybook'
import type { RepairPlaybook } from '../../models/repair'

const collectionsList = [
  'races',
  'entries',
  'boats',
  'blades',
  'divisionGroups',
  'silencedClashes',
  'silencedBladeClashes',
]

type Props = {
  onResult?: (result: ValidationResult | null) => void
  onPlaybook?: (playbook: RepairPlaybook | null) => void
}

export function ValidatorPanel({ onResult, onPlaybook }: Props) {
  const [limit, setLimit] = useState(50)
  const [maxIssues, setMaxIssues] = useState(100)
  const [selected, setSelected] = useState<string[]>(['races', 'entries'])
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playbook, setPlaybook] = useState<RepairPlaybook | null>(null)

  const toggleCollection = (name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))
  }

  const run = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setPlaybook(null)
    try {
      const res = await runValidation({ limitPerCollection: limit, maxIssues, collections: selected })
      setResult(res)
      onResult?.(res)
    } catch (err) {
      const msg = toErrorMessage(err)
      setError(msg)
      trace({ type: 'error', scope: 'validator', meta: { message: msg } })
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!result) return
    const payload = result.issues
      .map((i) => `${i.level.toUpperCase()} ${i.collection}/${i.docId} ${i.field ? `[${i.field}]` : ''} ${i.message}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(payload || 'No issues')
    } catch {
      alert('Clipboard unavailable')
    }
  }

  const buildPlaybook = () => {
    if (!result) return
    const pb = generateRepairPlaybook(result.issues)
    setPlaybook(pb)
    onPlaybook?.(pb)
  }

  const copyPlaybookMd = async () => {
    if (!playbook) return
    try {
      await navigator.clipboard.writeText(toMarkdown(playbook))
    } catch {
      alert('Clipboard unavailable')
    }
  }

  const copyPlaybookJson = async () => {
    if (!playbook) return
    try {
      await navigator.clipboard.writeText(toJson(playbook))
    } catch {
      alert('Clipboard unavailable')
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Validator (read-only)</h3>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <button className="row-action" onClick={run} disabled={loading}>Run validation</button>
          <button className="row-action" onClick={() => { setResult(null); setError(null) }}>Clear</button>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <label className="section-title">Collections (opt-in)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {collectionsList.map((c) => (
            <label key={c} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={selected.includes(c)} onChange={() => toggleCollection(c)} />
              {c}
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="section-title">Limit per collection</span>
          <input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 0)} style={{ width: 120 }} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="section-title">Max issues</span>
          <input type="number" min={1} max={1000} value={maxIssues} onChange={(e) => setMaxIssues(Number(e.target.value) || 0)} style={{ width: 120 }} />
        </label>
      </div>
      {loading ? <div>Running…</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {result ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div><strong>Scanned:</strong> {result.scanned}</div>
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <strong>Issues:</strong> {result.issues.length}
            <button className="row-action" onClick={copy} disabled={!result.issues.length}>Copy report</button>
            <button className="row-action" onClick={buildPlaybook} disabled={!result.issues.length}>Generate playbook</button>
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
            {result.issues.length === 0 ? <div>No issues</div> : result.issues.map((i, idx) => (
              <div key={`${i.collection}-${i.docId}-${idx}`} style={{ fontSize: 12, marginBottom: 4 }}>
                <strong>{i.level.toUpperCase()}</strong> {i.collection}/{i.docId} {i.field ? `[${i.field}]` : ''} — {i.message}
              </div>
            ))}
          </div>
          {playbook ? (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Repair playbook</strong>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Guidance only; no writes. Apply manually.</span>
                <button className="row-action" onClick={copyPlaybookMd}>Copy (markdown)</button>
                <button className="row-action" onClick={copyPlaybookJson}>Copy (JSON)</button>
              </div>
              {playbook.actions.length === 0 ? (
                <div>No repairs suggested.</div>
              ) : (
                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
                  {playbook.actions.map((a, idx) => (
                    <div key={`${a.collection}-${a.docId}-${a.field}-${idx}`} style={{ fontSize: 12, marginBottom: 4 }}>
                      <strong>{a.collection}/{a.docId}</strong> `{a.field}` — {a.action.toUpperCase()} {a.suggestedValue !== undefined ? `\`${JSON.stringify(a.suggestedValue)}\`` : ''} {a.note ? `(${a.note})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
