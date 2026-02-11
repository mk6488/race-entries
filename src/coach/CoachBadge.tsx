import { useEffect, useMemo, useRef, useState } from 'react'
import { useCoachContext } from './useCoachContext'
import { firebaseProjectId, functionsRegion } from '../firebase/functions'

type Props = {
  onOpenOnboarding: () => void
}

export function CoachBadge({ onOpenOnboarding }: Props) {
  const { ctx, refresh } = useCoachContext()
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const status: 'loading' | 'signedOut' | 'linked' | 'unlinked' | 'error' =
    ctx.status === 'authLoading' || ctx.status === 'signedInProfileLoading'
      ? 'loading'
      : ctx.status === 'signedOut'
        ? 'signedOut'
        : ctx.status === 'signedInLinked'
          ? 'linked'
          : ctx.status === 'signedInUnlinked'
            ? 'unlinked'
            : ctx.status === 'signedInError'
              ? 'error'
              : 'loading'

  const dotColor =
    status === 'linked'
      ? '#2e7d32'
      : status === 'unlinked'
        ? '#ed6c02'
        : status === 'error'
          ? '#d32f2f'
          : status === 'signedOut'
            ? '#455a64'
          : '#9e9e9e'

  const label =
    status === 'loading'
      ? 'Loading...'
      : status === 'linked'
        ? (ctx.coachName || 'Coach')
        : status === 'signedOut'
          ? 'Not signed in'
        : status === 'unlinked'
          ? 'Unlinked coach'
          : 'Coach identity error'

  const badgeStyle = useMemo<React.CSSProperties>(() => {
    return {
      position: 'fixed',
      top: 12,
      right: 16,
      zIndex: 1000,
    }
  }, [])

  const pillStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      borderRadius: 999,
      background: '#fff',
      border: '1px solid var(--border)',
      boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
      cursor: 'pointer',
      userSelect: 'none',
      maxWidth: 220,
    }
  }, [])

  const dotStyle = useMemo<React.CSSProperties>(() => {
    return { width: 10, height: 10, borderRadius: 999, background: dotColor, flex: '0 0 auto' }
  }, [dotColor])

  const textStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontSize: 13,
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }
  }, [])

  const menuStyle = useMemo<React.CSSProperties>(() => {
    return {
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      width: 220,
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 10,
      boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
      padding: 8,
      display: 'grid',
      gap: 6,
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function onDocClick(e: MouseEvent) {
      const el = rootRef.current
      if (!el) return
      if (e.target && el.contains(e.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [isOpen])

  async function handleCopyUid() {
    try {
      await navigator.clipboard.writeText(ctx.uid ?? '')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  return (
    <div ref={rootRef} style={badgeStyle}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Coach identity menu"
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsOpen((v) => !v)
          if (e.key === 'Escape') setIsOpen(false)
        }}
        style={pillStyle}
      >
        <span aria-hidden="true" style={dotStyle} />
        <span style={textStyle} title={label}>{label}</span>
        <span aria-hidden="true" style={{ color: 'var(--muted)', fontSize: 12 }}>{isOpen ? '▴' : '▾'}</span>
      </div>

      {isOpen ? (
        <div style={menuStyle} role="menu" aria-label="Coach menu">
          <button
            className="row-action"
            type="button"
            onClick={async () => {
              await refresh()
              setIsOpen(false)
            }}
          >
            Refresh identity
          </button>
          <button
            className="row-action"
            type="button"
            onClick={() => {
              onOpenOnboarding()
              setIsOpen(false)
            }}
          >
            Link / create profile
          </button>
          <button className="row-action" type="button" onClick={handleCopyUid}>
            {copied ? 'Copied' : 'Copy UID'}
          </button>
          {import.meta.env.DEV ? (
            <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
              Functions: {functionsRegion}
              <br />
              Project: {firebaseProjectId}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

