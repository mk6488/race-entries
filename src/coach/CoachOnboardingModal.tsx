import { useState } from 'react'
import type { CoachContext } from './coachContext'
import { createCoachProfile, linkDeviceToCoach, logCallableError } from '../firebase/functions'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/components/Field'
import { Button } from '../ui/components/Button'
import { ErrorBanner } from '../ui/components/ErrorBanner'

type Props = {
  ctx: CoachContext
  refresh: () => Promise<void>
  forceOpen?: boolean
  onRequestClose?: () => void
}

type Tab = 'create' | 'link'

function toUiError(err: unknown): string {
  if (typeof err === 'object' && err && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return 'Something went wrong. Please try again.'
}

export function CoachOnboardingModal({ ctx, refresh, forceOpen, onRequestClose }: Props) {
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem('coach:onboarding:dismissedUntil')
      const n = raw ? Number(raw) : 0
      return Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  })

  const now = Date.now()
  const shouldShow = !!forceOpen || (!ctx.loading && !ctx.isLinked && now >= dismissedUntil)

  const [tab, setTab] = useState<Tab>('link')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pin, setPin] = useState('')
  const [deviceLabel, setDeviceLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchOptions, setMatchOptions] = useState<Array<{ coachId: string; label: string }>>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')

  function dismissFor(minutes: number) {
    const until = Date.now() + minutes * 60 * 1000
    setDismissedUntil(until)
    try {
      sessionStorage.setItem('coach:onboarding:dismissedUntil', String(until))
    } catch {
      // ignore
    }
  }

  async function handleSubmit() {
    if (busy) return
    setError(null)
    setMatchOptions([])
    setSelectedCoachId('')
    setBusy(true)
    try {
      const base = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pin: pin.trim(),
        deviceLabel: deviceLabel.trim() || undefined,
      }
      if (!base.firstName || !base.lastName || !base.pin) {
        setError('Please enter first name, last name, and PIN.')
        return
      }

      if (tab === 'create') {
        await createCoachProfile(base)
      } else {
        await linkDeviceToCoach(base)
      }

      // Never keep PIN beyond the session interaction.
      setPin('')
      await refresh()
      if (forceOpen) onRequestClose?.()
      else dismissFor(60 * 24) // hide for the rest of session once linked
    } catch (err) {
      logCallableError(tab === 'create' ? 'createCoachProfile' : 'linkDeviceToCoach', err)
      const details = (err as { details?: unknown }).details
      const d = details && typeof details === 'object' ? (details as Record<string, unknown>) : null
      const multipleMatches = !!d && d.multipleMatches === true
      const matches = d && Array.isArray(d.matches) ? (d.matches as unknown[]) : null
      if (tab === 'link' && multipleMatches && matches && matches.length) {
        const options = matches
          .map((m) => {
            if (typeof m === 'string') return { coachId: m, label: m }
            if (m && typeof m === 'object') {
              const rec = m as Record<string, unknown>
              const coachId = typeof rec.coachId === 'string' ? rec.coachId : ''
              const name = typeof rec.name === 'string' ? rec.name : ''
              if (coachId) return { coachId, label: name ? `${name} (${coachId})` : coachId }
            }
            return null
          })
          .filter(Boolean) as Array<{ coachId: string; label: string }>
        if (options.length) {
          setMatchOptions(options)
          setSelectedCoachId(options[0].coachId)
          setError('Multiple matching coach profiles found. Select the correct coach and try again.')
        } else {
          setError('Multiple matching coach profiles found. Please refine the name or contact an admin.')
        }
      } else {
        setError(toUiError(err))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleLinkSelected() {
    if (tab !== 'link' || busy) return
    if (!selectedCoachId) return
    setError(null)
    setBusy(true)
    try {
      await linkDeviceToCoach({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pin: pin.trim(),
        deviceLabel: deviceLabel.trim() || undefined,
        coachId: selectedCoachId,
      })
      setPin('')
      await refresh()
      if (forceOpen) onRequestClose?.()
      else dismissFor(60 * 24)
    } catch (err) {
      logCallableError('linkDeviceToCoach', err)
      setError(toUiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={shouldShow}
      title="Coach identity"
      onClose={() => {
        if (forceOpen) onRequestClose?.()
        else dismissFor(10)
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (forceOpen) onRequestClose?.()
              else dismissFor(10)
            }}
          >
            Continue unlinked
          </Button>
          <Button type="button" disabled={busy} onClick={handleSubmit}>
            {busy ? 'Saving…' : tab === 'create' ? 'Create profile' : 'Link device'}
          </Button>
        </div>
      }
    >
      {ctx.error ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          Note: coach identity refresh failed. You can still continue unlinked.
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          className="row-action"
          onClick={() => setTab('link')}
          aria-label="Link existing coach"
          style={{ fontWeight: tab === 'link' ? 700 : 400 }}
        >
          Link existing
        </button>
        <button
          className="row-action"
          onClick={() => setTab('create')}
          aria-label="Create coach profile"
          style={{ fontWeight: tab === 'create' ? 700 : 400 }}
        >
          Create profile
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        {tab === 'create'
          ? 'Create a coach profile and link this device.'
          : 'Link this device to an existing coach profile.'}
      </div>

      <div className="form-grid">
        <Field id="coach-first" label="First name" value={firstName} onChange={setFirstName} required disabled={busy} />
        <Field id="coach-last" label="Last name" value={lastName} onChange={setLastName} required disabled={busy} />
        <Field id="coach-pin" label="PIN" type="password" value={pin} onChange={setPin} required disabled={busy} />
        <Field
          id="coach-device"
          label="Device label (optional)"
          value={deviceLabel}
          onChange={setDeviceLabel}
          placeholder="e.g. Mike’s iPad"
          disabled={busy}
        />
      </div>

      {tab === 'link' && matchOptions.length ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Select coach profile:</div>
          <select value={selectedCoachId} onChange={(e) => setSelectedCoachId(e.target.value)} disabled={busy}>
            {matchOptions.map((m) => (
              <option key={m.coachId} value={m.coachId}>{m.label}</option>
            ))}
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="secondary" disabled={busy} onClick={handleLinkSelected}>
              {busy ? 'Linking…' : 'Link selected coach'}
            </Button>
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
        PIN is used only to link your device and is not stored in the app.
      </div>
    </Modal>
  )
}

