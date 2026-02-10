import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/components/Button'
import { ErrorBanner } from '../ui/components/ErrorBanner'
import { Field } from '../ui/components/Field'
import { createCoachProfile, linkDeviceToCoach, type CoachMatch } from '../identity/coachIdentity'
import { toErrorMessage } from '../utils/errors'

type Props = {
  onResolved: () => void
}

type Mode = 'create' | 'link'

export function Onboarding({ onResolved }: Props) {
  const [mode, setMode] = useState<Mode>('create')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [deviceLabel, setDeviceLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<CoachMatch[]>([])

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMatches([])
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter first and last name.')
      return
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (pin !== confirmPin) {
      setError('PIN confirmation does not match.')
      return
    }
    try {
      setBusy(true)
      await createCoachProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pin,
        deviceLabel: deviceLabel.trim() || undefined,
      })
      onResolved()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMatches([])
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter first and last name.')
      return
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    try {
      setBusy(true)
      const res = await linkDeviceToCoach({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pin,
        deviceLabel: deviceLabel.trim() || undefined,
      })
      if (res.requiresPick && res.matches?.length) {
        setMatches(res.matches)
        return
      }
      onResolved()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function pickCoach(coachId: string) {
    setError(null)
    try {
      setBusy(true)
      await linkDeviceToCoach({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pin,
        coachId,
        deviceLabel: deviceLabel.trim() || undefined,
      })
      onResolved()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="print-root" style={{ maxWidth: 560, margin: '24px auto', display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Coach identity setup</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          This device needs a coach profile before continuing.
        </p>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <Button variant={mode === 'create' ? 'primary' : 'secondary'} onClick={() => setMode('create')} disabled={busy}>
            Create profile
          </Button>
          <Button variant={mode === 'link' ? 'primary' : 'secondary'} onClick={() => setMode('link')} disabled={busy}>
            Link existing
          </Button>
        </div>
        {error ? <ErrorBanner message={error} /> : null}

        {mode === 'create' ? (
          <form onSubmit={submitCreate} style={{ display: 'grid', gap: 12 }}>
            <Field id="coach-first-name" label="First name" value={firstName} onChange={setFirstName} required />
            <Field id="coach-last-name" label="Last name" value={lastName} onChange={setLastName} required />
            <Field id="coach-pin" label="PIN (4 digits)" value={pin} onChange={setPin} type="password" required />
            <Field
              id="coach-pin-confirm"
              label="Confirm PIN"
              value={confirmPin}
              onChange={setConfirmPin}
              type="password"
              required
            />
            <Field
              id="coach-device-label"
              label="Device label (optional)"
              value={deviceLabel}
              onChange={setDeviceLabel}
              placeholder="e.g. Mike's iPad"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Create profile'}</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitLink} style={{ display: 'grid', gap: 12 }}>
            <Field id="coach-link-first-name" label="First name" value={firstName} onChange={setFirstName} required />
            <Field id="coach-link-last-name" label="Last name" value={lastName} onChange={setLastName} required />
            <Field id="coach-link-pin" label="PIN (4 digits)" value={pin} onChange={setPin} type="password" required />
            <Field
              id="coach-link-device-label"
              label="Device label (optional)"
              value={deviceLabel}
              onChange={setDeviceLabel}
              placeholder="e.g. Club laptop"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" disabled={busy}>{busy ? 'Linking...' : 'Link device'}</Button>
            </div>
          </form>
        )}

        {matches.length ? (
          <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Multiple matches found</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Pick your coach profile:</div>
            {matches.map((m) => (
              <div key={m.coachId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span>{m.firstName} {m.lastName}</span>
                <Button onClick={() => pickCoach(m.coachId)} disabled={busy}>Select</Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
