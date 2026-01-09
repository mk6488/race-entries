import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

type Info = {
  uid?: string
  loading: boolean
}

const version = import.meta.env.VITE_COMMIT_SHA || import.meta.env.VITE_BUILD_TIME || ''
const buildLabel = version ? `Build: ${version}` : `Build time: ${new Date().toLocaleString()}`

export function Diagnostics() {
  const [info, setInfo] = useState<Info>({ loading: true })
  const isDev = import.meta.env.DEV

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setInfo({ loading: false, uid: user?.uid })
    })
    return unsub
  }, [])

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      {isDev ? <div style={{ padding: 8, borderRadius: 8, background: '#e0f2fe', color: '#0b4f71' }}>Diagnostics (dev mode)</div> : null}
      <h1>Diagnostics</h1>
      <div>{buildLabel}</div>
      <div>Auth: {info.loading ? 'Loading...' : info.uid ? `Anon UID: ${info.uid}` : 'No user'}</div>
      <div>Diagnostics active</div>
    </div>
  )
}
