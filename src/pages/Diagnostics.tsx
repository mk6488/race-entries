import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { buildInfo } from '../utils/buildInfo'
import { useLocation } from 'react-router-dom'
import { getActiveSubscriptions } from '../data/subscriptionCache'
import { getTrace, clearTrace } from '../utils/trace'
import { ValidatorPanel } from '../ui/components/ValidatorPanel'

type Info = {
  uid?: string
  loading: boolean
}

export function Diagnostics() {
  const [info, setInfo] = useState<Info>({ loading: true })
  const isDev = import.meta.env.DEV
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const [subs, setSubs] = useState<{ key: string; listeners: number }[]>([])
  const [traceView, setTraceView] = useState(getTrace())
  const devLogSentRef = useRef(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setInfo({ loading: false, uid: user?.uid })
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

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      {isDev ? <div style={{ padding: 8, borderRadius: 8, background: '#e0f2fe', color: '#0b4f71' }}>Diagnostics (dev mode)</div> : null}
      <h1>Diagnostics</h1>
      <div><strong>Version:</strong> {buildInfo.version}</div>
      <div><strong>Build time:</strong> {buildInfo.buildTime}</div>
      <div><strong>Env:</strong> {isDev ? 'dev' : 'prod'}</div>
      <div><strong>Route:</strong> {location.pathname}</div>
      <div><strong>Auth:</strong> {info.loading ? 'Loading...' : info.uid ? `Anon UID: ${info.uid}` : 'No user'}</div>
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
      {isDev ? <ValidatorPanel /> : null}
    </div>
  )
}
