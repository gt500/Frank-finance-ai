import { useState } from 'react'
import { C, FONT_BODY, FONT_SUB } from '../lib/theme'
import { useTenant, AdminSwitcher } from '../context/TenantContext'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',       icon: '▦' },
  { id: 'cashflow',   label: 'Cash Flow',        icon: '◱', badgeKey: 'highFlags',   badgeColor: C.danger },
  { id: 'reports',    label: 'Reports',          icon: '▤' },
  { id: 'health',     label: 'Business Health',  icon: '◈', badgeKey: 'hScore',      badgeColor: null },
  { id: 'documents',  label: 'Documents',        icon: '↑' },
  { id: 'ar',         label: 'Debtors',          icon: '⊟' },
  { id: 'ap',         label: 'Creditors',        icon: '⊞' },
  { id: 'reconcile',  label: 'Reconciliation',   icon: '⇌', badgeKey: 'unmatched',   badgeColor: C.warn },
  { id: 'billing',    label: 'Billing',          icon: '🧾' },
  { id: 'connect',    label: 'Connections',      icon: '⊕' },
  { id: 'chat',       label: 'Ask Zeeder',       icon: '◉' },
]

export function Sidebar({ view, onNav, onAsk }) {
  const { tenant, data, tenants, bankData, currentUser, logout, deleteAccount, canDeleteAccount } = useTenant()
  const [showSwitcher, setShowSwitcher] = useState(false)

  const hScore    = Math.round(data.HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / data.HEALTH_CHECKS.length)
  const highFlags = data.CASHFLOW_FLAGS.filter(f => f.severity === 'HIGH').length
  const hColor    = hScore > 75 ? C.frank : hScore > 55 ? C.warn : C.danger

  const unmatched = bankData && !bankData.isConfirmed
    ? (bankData.credits.filter(t => !t.matchedName && !t.confirmed).length +
       bankData.debits.filter(t => !t.matchedName && !t.confirmed).length)
    : null

  const badges = { highFlags, hScore, unmatched }
  const badgeColors = { highFlags: C.danger, hScore: hColor, unmatched: C.warn }

  return (
    <>
      <aside style={{
        width: 250,
        background: C.sidebar,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        overflow: 'hidden',
      }}>

        {/* Logo — source PNG is a 500x500 square with the wordmark sitting in
            a thin band roughly a third of the way down, so the display area
            is cropped (top-aligned, overflow hidden) to just that band. */}
        <div style={{ padding: '6px 16px 4px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: '70%', margin: '0 auto', height: 76, overflow: 'hidden' }}>
            <img src="/zeeder-logo.png" alt="Zeeder AI" style={{ width: '100%', display: 'block' }} />
          </div>
          <div style={{ fontFamily: FONT_SUB, fontSize: 10, color: C.gold, letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center', marginTop: 2 }}>
            Finance OS
          </div>
        </div>

        {/* Business card */}
        <div style={{ padding: '14px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: 0.3 }}>{tenant.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2, letterSpacing: 0.5 }}>{tenant.sector}</div>
          {tenant.children != null
            ? <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{tenant.children} learners · {tenant.staff} staff</div>
            : <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{tenant.staff} staff · {tenant.location}</div>
          }

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="blink" style={{ width: 6, height: 6, borderRadius: '50%', background: C.frank, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.frank, letterSpacing: 0.5 }}>Bank connected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.warn, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.warn, letterSpacing: 0.5 }}>No accounting software</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, minHeight: 0, padding: '10px 10px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(n => {
            const active    = view === n.id
            const badgeVal  = n.badgeKey ? badges[n.badgeKey] : null
            const badgeCol  = n.badgeKey ? badgeColors[n.badgeKey] : null
            return (
              <button key={n.id} onClick={() => onNav(n.id)}
                className="nav-item"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 4,
                  border: 'none',
                  borderLeft: active ? `2px solid ${C.frank}` : '2px solid transparent',
                  cursor: 'pointer',
                  background: active ? C.frankMid : 'transparent',
                  color: active ? C.frank : C.sub,
                  fontSize: 16,
                  fontWeight: active ? 600 : 400,
                  marginBottom: 2,
                  textAlign: 'left',
                  letterSpacing: active ? 0.3 : 0,
                }}>
                <span style={{ fontSize: 16, opacity: active ? 1 : 0.6, flexShrink: 0 }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {badgeVal != null && (
                  <span style={{
                    fontSize: 12, background: `${badgeCol}18`, color: badgeCol,
                    borderRadius: 3, padding: '1px 6px', fontWeight: 700,
                    border: `1px solid ${badgeCol}30`, letterSpacing: 0.5,
                  }}>
                    {badgeVal}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Plan footer */}
        <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>

          {/* User info row */}
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: 11, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.email}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button
                  onClick={logout}
                  title="Sign out"
                  style={{
                    padding: '4px 9px', borderRadius: 3,
                    border: `1px solid ${C.border}`, background: 'transparent',
                    color: C.dim, fontSize: 11, cursor: 'pointer', letterSpacing: 0.5,
                  }}>
                  Sign out
                </button>
                {canDeleteAccount && (
                  <button
                    onClick={() => {
                      if (window.confirm('Delete your account and all data? This cannot be undone.')) deleteAccount()
                    }}
                    title="Delete account"
                    style={{
                      padding: '4px 7px', borderRadius: 3,
                      border: `1px solid ${C.danger}30`, background: 'transparent',
                      color: C.danger, fontSize: 11, cursor: 'pointer',
                    }}>
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: C.dim, letterSpacing: 1, textTransform: 'uppercase' }}>
              {tenant.plan} Plan · R {tenant.planPrice}/mo
            </div>
            {tenants.length > 1 && (
              <button
                onClick={() => setShowSwitcher(true)}
                title="Admin: switch tenant"
                style={{
                  padding: '3px 7px', borderRadius: 3,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.dim, fontSize: 14, cursor: 'pointer', lineHeight: 1,
                }}>
                ⚙
              </button>
            )}
          </div>
          <button onClick={() => onAsk('What would I get if I upgraded to the Zeeder Finance OS Growth plan?')}
            style={{
              width: '100%', padding: '8px', borderRadius: 4,
              border: `1px solid ${C.frank}30`, background: C.frankDim,
              color: C.frank, fontSize: 12, cursor: 'pointer', fontWeight: 600,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
            Upgrade → R 999/mo
          </button>
        </div>
      </aside>

      {showSwitcher && <AdminSwitcher onClose={() => setShowSwitcher(false)} />}
    </>
  )
}
