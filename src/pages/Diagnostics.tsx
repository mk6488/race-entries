import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { buildInfo } from '../utils/buildInfo'
import { useLocation, useNavigate } from 'react-router-dom'
import { getActiveSubscriptions } from '../data/subscriptionCache'
import { getTrace, clearTrace } from '../utils/trace'
import { buildDiagnosticsBundle } from '../utils/buildDiagnosticsBundle'
import type { ValidationResult } from '../data/scanCollections'
import type { RepairPlaybook } from '../models/repair'
import { ValidatorPanel } from '../ui/components/ValidatorPanel'
import { Button } from '../ui/components/Button'

type Info = {
  uid?: string
  isAnonymous?: boolean
  loading: boolean
  email?: string
}

export function Diagnostics() {
  const [info, setInfo] = useState<Info>({ loading: true })
  const isDev = import.meta.env.DEV
  const location = useLocation()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [subs, setSubs] = useState<{ key: string; listeners: number }[]>([])
  const [traceView, setTraceView] = useState(getTrace())
  const devLogSentRef = useRef(false)
  const [validatorResult, setValidatorResult] = useState<ValidationResult | null>(null)
  const [playbook, setPlaybook] = useState<RepairPlaybook | null>(null)
  const [bundleStatus, setBundleStatus] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setInfo({ loading: false, uid: user?.uid, isAnonymous: user?.isAnonymous, email: user?.email || undefined })
    })
    return unsub
  }, [])

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d642789e-3b70-4e47-8ce4-aeffdaf4e848', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'Diagnostics.tsx:mount',
        message: 'Diagnostics mounted',
        data: { isDev, initialTraceLen: getTrace().length },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [isDev])

  useEffect(() => {
    if (!isDev) return
    const id = setInterval(() => {
      setSubs(getActiveSubscriptions())
      setTraceView(getTrace().slice(-30))
    }, 1000)
    if (!devLogSentRef.current) {
      devLogSentRef.current = true
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d642789e-3b70-4e47-8ce4-aeffdaf4e848', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'Diagnostics.tsx:devEffect',
          message: 'Dev diagnostics interval armed',
          data: { traceLen: getTrace().length, subsCount: getActiveSubscriptions().length },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
    }
    return () => clearInterval(id)
  }, [isDev])

  const copyDiagnostics = async () => {
    const payload = [
      `version: ${buildInfo.version}`,
      `build: ${buildInfo.buildTime}`,
      `env: ${isDev ? 'dev' : 'prod'}`,
      `uid: ${info.uid || 'none'}`,
      `url: ${window.location.href}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
      alert('Clipboard unavailable')
    }
  }

  const copyTrace = async () => {
    const last = getTrace().slice(-30)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d642789e-3b70-4e47-8ce4-aeffdaf4e848', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'Diagnostics.tsx:copyTrace',
        message: 'Copy trace invoked',
        data: { items: last.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    const payload = last.map((t) => `${new Date(t.ts).toISOString()} ${t.type} ${t.scope || ''} ${t.meta ? JSON.stringify(t.meta) : ''}`).join('\n')
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      alert('Clipboard unavailable')
    }
  }

  const buildBundle = () => {
    try {
      const bundle = buildDiagnosticsBundle({
        auth: { uid: info.uid, isAnonymous: info.isAnonymous },
        routePath: location.pathname,
        subs: { active: subs.reduce((sum, s) => sum + s.listeners, 0), keys: subs.map((s) => s.key) },
        validator: validatorResult,
        playbook,
      })
      return bundle
    } catch (err) {
      setBundleStatus('Failed to build bundle')
      return null
    }
  }

  const copyBundle = async () => {
    const bundle = buildBundle()
    if (!bundle) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2))
      setBundleStatus('Bundle copied')
      setTimeout(() => setBundleStatus(null), 1500)
    } catch {
      setBundleStatus('Clipboard unavailable')
    }
  }

  const downloadBundle = () => {
    const bundle = buildBundle()
    if (!bundle) return
    const json = JSON.stringify(bundle, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const ts = new Date().toISOString().replace(/[:]/g, '-')
    const name = `diagnostics_${buildInfo.version || 'unknown'}_${ts}.json`
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    setBundleStatus('Bundle downloaded')
    setTimeout(() => setBundleStatus(null), 1500)
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      {isDev ? <div style={{ padding: 8, borderRadius: 8, background: '#e0f2fe', color: '#0b4f71' }}>Diagnostics (dev mode)</div> : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Diagnostics</h1>
        {!info.isAnonymous && !info.loading ? (
          <Button variant="secondary" onClick={async () => { await signOut(auth); navigate('/admin/login') }}>
            Log out
          </Button>
        ) : null}
      </div>
      <div><strong>Version:</strong> {buildInfo.version}</div>
      <div><strong>Build time:</strong> {buildInfo.buildTime}</div>
      <div><strong>Env:</strong> {isDev ? 'dev' : 'prod'}</div>
      <div><strong>Route:</strong> {location.pathname}</div>
      <div><strong>Auth:</strong> {info.loading ? 'Loading...' : info.email ? `Admin: ${info.email}` : info.uid ? `Anon UID: ${info.uid}` : 'No user'}</div>
      <div>Diagnostics active</div>
      <div className="print-hide" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <button onClick={copyDiagnostics}>Copy diagnostics</button>
        {copied ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>Copied</span> : null}
      </div>
      {isDev && subs.length ? (
        <div style={{ marginTop: 8 }}>
          <div><strong>Active subscriptions:</strong> {subs.reduce((sum, s) => sum + s.listeners, 0)}</div>
          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
            {subs.map((s) => (
              <li key={s.key} style={{ listStyle: 'disc' }}>
                {s.key} ({s.listeners})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {isDev && traceView.length ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>Recent trace</strong>
            <button className="row-action" onClick={copyTrace}>Copy last 30</button>
            <button className="row-action" onClick={() => { clearTrace(); setTraceView([]); }}>Clear</button>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
            {traceView.slice(-30).map((t, i) => (
              <div key={`${t.ts}-${i}`} style={{ fontSize: 12, color: '#0f172a', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>{new Date(t.ts).toISOString()}</span> — <strong>{t.type}</strong> {t.scope ? `(${t.scope})` : ''} {t.meta ? JSON.stringify(t.meta) : ''}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {isDev ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <ValidatorPanel onResult={setValidatorResult} onPlaybook={setPlaybook} />
          <div className="card" style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Diagnostics bundle</h3>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Non-sensitive summary; admin-only</span>
            </div>
            <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="row-action" onClick={copyBundle}>Copy bundle (JSON)</button>
              <button className="row-action" onClick={downloadBundle}>Download bundle (.json)</button>
              {bundleStatus ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>{bundleStatus}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
