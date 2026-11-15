import { LayoutDashboard, TrendingUp, FileBarChart, Scale, HeartPulse, Upload, FileText, Users, CreditCard, ArrowLeftRight, Plug, MessageCircle } from 'lucide-react'
import { C, FONT_SUB } from '../lib/theme'
import { useTenant } from '../context/TenantContext'
import { supabase } from '../lib/supabaseClient'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',       Icon: LayoutDashboard },
  { id: 'cashflow',   label: 'Cash Flow',       Icon: TrendingUp, badgeKey: 'highFlags' },
  { id: 'reports',    label: 'Reports',         Icon: FileBarChart },
  { id: 'statements', label: 'Financial Statements', Icon: Scale },
  { id: 'health',     label: 'Business Health', Icon: HeartPulse, badgeKey: 'hScore' },
  { id: 'documents',  label: 'Documents',       Icon: Upload },
  { id: 'invoices',   label: 'Invoices',        Icon: FileText },
  { id: 'ar',         label: 'Debtors',         Icon: Users },
  { id: 'ap',         label: 'Creditors',       Icon: CreditCard },
  { id: 'reconcile',  label: 'Reconciliation',  Icon: ArrowLeftRight, badgeKey: 'unmatched' },
  { id: 'connect',    label: 'Connections',     Icon: Plug },
  { id: 'chat',       label: 'Ask Zeeder',      Icon: MessageCircle },
]

export function Sidebar({ view, onNav, onAsk }) {
  const { tenant, data, bankData, currentUser, logout, deleteAccount, canDeleteAccount, subscription, cancelSubscription } = useTenant()
  const hScore    = Math.round(data.HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / data.HEALTH_CHECKS.length)
  const highFlags = data.CASHFLOW_FLAGS.filter(f => f.severity === 'HIGH').length
  const unmatched = bankData && !bankData.isConfirmed
    ? (bankData.credits.filter(t => !t.matchedName && !t.confirmed).length + bankData.debits.filter(t => !t.matchedName && !t.confirmed).length)
    : null
  const badges = { highFlags: highFlags || null, hScore, unmatched: unmatched || null }
  const badgeColors = { highFlags: C.watch, hScore: hScore > 75 ? C.frank : C.watch, unmatched: C.gold }

  return (
    <>
      <aside className="glass" style={{ width: 252, margin: 14, marginRight: 0, height: 'calc(100vh - 28px)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Brand — wordmark + gold Bruno Ace sub-brand, as on the Skills Hub */}
        <div style={{ padding: '18px 18px 10px' }}>
          <img src="/zeeder-logo.png" alt="Zeeder" style={{ width: '72%', display: 'block', marginBottom: -40 }} />
          <div style={{ fontFamily: FONT_SUB, fontSize: 15, color: C.gold, letterSpacing: '.08em', textTransform: 'uppercase', lineHeight: 1 }}>Finance OS</div>
        </div>

        {/* Business card */}
        <div style={{ margin: '6px 12px 8px', padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{tenant.name}</div>
          <div style={{ fontSize: 12, color: C.label, marginTop: 2 }}>
            {tenant.sector}{tenant.children != null ? ` · ${tenant.children} learners` : tenant.location ? ` · ${tenant.location}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 12, color: bankData ? C.frank : C.label }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: bankData ? C.frank : C.label, boxShadow: bankData ? `0 0 10px ${C.frank}` : 'none', flexShrink: 0 }} />
            {bankData ? 'Bank statement loaded' : 'No bank statement yet'}
          </div>
        </div>

        <nav aria-label="Main" style={{ flex: '1 0 auto', padding: '4px 10px' }}>
          {NAV_ITEMS.map(({ id, label, Icon, badgeKey }) => {
            const active = view === id
            const badgeVal = badgeKey ? badges[badgeKey] : null
            const badgeCol = badgeKey ? badgeColors[badgeKey] : null
            return (
              <button key={id} onClick={() => onNav(id)} className="nav-item" aria-current={active ? 'page' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 42, padding: '0 12px', borderRadius: 11, marginBottom: 2, textAlign: 'left', cursor: 'pointer', fontSize: 14,
                  border: active ? '1px solid rgba(32,229,246,0.35)' : '1px solid transparent',
                  background: active ? 'linear-gradient(90deg, rgba(32,229,246,0.16), rgba(32,229,246,0.03))' : 'transparent',
                  color: active ? C.frank : C.soft }}>
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                <span style={{ flex: 1 }}>{label}</span>
                {badgeVal != null && (
                  <span className="num" style={{ fontSize: 11, color: badgeCol, background: `${badgeCol}1f`, border: `1px solid ${badgeCol}40`, borderRadius: 999, padding: '1px 7px' }}>{badgeVal}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Plan footer — reflects real subscription */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div>
                <div style={{ fontSize: 11, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button onClick={logout} title="Sign out" style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: C.soft, fontSize: 11, cursor: 'pointer' }}>Sign out</button>
                {canDeleteAccount && (
                  <button onClick={async () => { if (window.confirm('Delete your account and all data? This cannot be undone.')) { const r = await deleteAccount(); if (!r.ok) window.alert(`Account not deleted: ${r.error}`) } }} title="Delete account"
                    aria-label="Delete account" style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: C.label, fontSize: 12, cursor: 'pointer' }}>×</button>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: C.dim, letterSpacing: 1, textTransform: 'uppercase' }}>
              {subscription ? `${subscription.plan} Plan · R ${(subscription.amount_cents / 100).toLocaleString('en-ZA')}/mo` : tenant?.demo ? 'Demo workspace' : `Trial — ${currentUser?.trialDaysLeft ?? 0} days left`}
            </div>
          </div>
          {subscription ? (
            <button onClick={async () => { if (window.confirm('Cancel your subscription? You keep access until the end of the paid period.')) { const r = await cancelSubscription(); if (!r.ok) onAsk(`Cancellation failed: ${r.error}`) } }}
              className="btn-ghost" style={{ width: '100%', fontSize: 12, color: C.soft }}>Cancel subscription</button>
          ) : tenant?.demo ? null : (
            <button onClick={async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session) throw new Error('Not signed in — please log in again.')
                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paygate-initiate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ plan: tenant.plan === 'Starter' ? 'starter' : 'growth', first_name: currentUser?.name?.split(' ')[0], last_name: currentUser?.name?.split(' ').slice(1).join(' ') }),
                  })
                  const data = await res.json()
                  if (data.redirect_url) window.location.href = data.redirect_url
                  else onAsk(`Upgrade failed: ${data.error ?? 'unknown error'}. What should I check?`)
                } catch (e) { onAsk(`Upgrade failed to start: ${e.message}. What should I check?`) }
              }}
              className="btn-gold" style={{ width: '100%' }}>Upgrade →</button>
          )}
        </div>
      </aside>
    </>
  )
}