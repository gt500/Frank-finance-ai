import { useState } from 'react'
import { C, FONT_BODY } from '../lib/theme'

const MIN_LENGTH = 8

const field = {
  width: '100%', padding: '11px 14px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.bg, color: C.text, fontSize: 14, outline: 'none', fontFamily: FONT_BODY, boxSizing: 'border-box',
}
const label = { fontSize: 11, color: C.dim, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }

/** Shown after someone follows the link in a password-reset email: they choose a new password before anything else. */
export function ResetPassword({ onSubmit, onCancel }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`)
    if (password !== confirm) return setError('The two passwords do not match.')
    setError(''); setBusy(true)
    const result = await onSubmit(password)
    if (!result.ok) setError(result.error)
    setBusy(false)
    return undefined
  }

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${C.card} 0%, ${C.bg} 70%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FONT_BODY }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 6 }}>Choose a new password</div>
          <div style={{ fontSize: 14, color: C.sub }}>You are signed in with a one-time link. Set a new password to continue.</div>
        </div>
        <div>
          <label htmlFor="new-password" style={label}>New password</label>
          <input id="new-password" type="password" autoComplete="new-password" autoFocus required value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }} style={field} />
        </div>
        <div>
          <label htmlFor="confirm-password" style={label}>Repeat new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError('') }} style={field} />
        </div>
        {error && <div role="alert" style={{ padding: '10px 14px', background: `${C.danger}10`, border: `1px solid ${C.danger}30`, borderRadius: 6, fontSize: 13, color: C.danger }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ padding: '13px', borderRadius: 6, border: 'none', background: C.frank, color: '#000', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', letterSpacing: 1, textTransform: 'uppercase', opacity: busy ? 0.7 : 1, fontFamily: FONT_BODY }}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: FONT_BODY }}>Cancel and sign out</button>
      </form>
    </div>
  )
}
