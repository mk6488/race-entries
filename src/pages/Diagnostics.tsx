import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { buildInfo } from '../utils/buildInfo'
import { useLocation } from 'react-router-dom'
import { getActiveSubscriptions } from '../data/subscriptionCache'

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setInfo({ loading: false, uid: user?.uid })
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!isDev) return
    const id = setInterval(() => {
      setSubs(getActiveSubscriptions())
    }, 1000)
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
    </div>
  )
}
