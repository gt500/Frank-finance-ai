import { useState } from 'react'
import { C } from '../lib/theme'
import { useTenant } from '../context/TenantContext'
import { allows, packWith, priceText, FEATURES } from '../lib/plans'
import { startUpgrade } from '../lib/upgrade'
import { LEGAL } from '../pages/legalContent'

/** What the current workspace's pack allows. `can('invoicing')` is true on Growth and Pro. */
export function usePlanAccess() {
  const { plan } = useTenant()
  return { plan, can: (feature) => !plan || allows(plan, feature) }
}

/** Shown in place of a feature the workspace's pack does not include. Nothing is lost: the data stays safe. */
export function LockedFeature({ feature, label }) {
  const { subscription, currentUser } = useTenant()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pack = packWith(feature)

  async function upgrade() {
    setBusy(true); setError('')
    const r = await startUpgrade({ planId: pack.id, user: currentUser })
    if (!r.ok) setError(`Could not start the upgrade: ${r.error}`)
    setBusy(false)
  }

  return (
    <div className="glass" role="region" aria-label={`${label} is not in your pack`} style={{ padding: 28, maxWidth: 640 }}>
      <h2 className="ttl">{label}</h2>
      <p style={{ color: C.text, fontSize: 18, margin: '10px 0 6px' }}>This is part of the {pack.name} pack.</p>
      <p style={{ color: C.soft, fontSize: 14, lineHeight: 1.6 }}>
        {FEATURES[feature]} {pack.name} is {priceText(pack)} a month and includes everything in the packs below it. Your information is safe and stays as it is.
      </p>
      {subscription ? (
        <p style={{ color: C.soft, fontSize: 14, marginTop: 14 }}>
          To move to {pack.name}, email <a href={`mailto:${LEGAL.email}?subject=Change%20my%20pack`} style={{ color: C.frank }}>{LEGAL.email}</a> and we will change it for you.
        </p>
      ) : (
        <button type="button" className="btn-gold" style={{ marginTop: 16 }} disabled={busy} onClick={upgrade}>
          {busy ? 'Starting…' : `Upgrade to ${pack.name}`}
        </button>
      )}
      {error && <div role="alert" style={{ marginTop: 12, color: C.danger, fontSize: 13 }}>{error}</div>}
    </div>
  )
}
