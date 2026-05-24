import { C } from '../../lib/theme'
import { BUSINESS, HEALTH_CHECKS, CASHFLOW_FLAGS } from '../../data/wonderland'

const hScore = Math.round(HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / HEALTH_CHECKS.length)
const highFlags = CASHFLOW_FLAGS.filter(f => f.severity === 'HIGH').length

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: '▦',  badge: null },
  { id: 'cashflow',   label: 'Cash Flow',       icon: '◱',  badge: highFlags,  badgeColor: C.danger },
  { id: 'reports',    label: 'Reports',         icon: '▤',  badge: null },
  { id: 'health',     label: 'Business Health', icon: '◈',  badge: hScore,     badgeColor: hScore > 75 ? C.frank : hScore > 55 ? C.warn : C.danger },
  { id: 'documents',  label: 'Upload Documents',icon: '↑',  badge: null },
  { id: 'ar',         label: 'Debtors',         icon: '⊟',  badge: null },
  { id: 'ap',         label: 'Creditors',       icon: '⊞',  badge: null },
  { id: 'connect',    label: 'Connections',     icon: '⊕',  badge: null },
  { id: 'chat',       label: 'Ask Frank',       icon: '◉',  badge: null },
]

export function Sidebar({ view, onNav, onAsk }) {
  return (
    <aside style={{ width: 210, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh' }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.frank, letterSpacing: '-0.5px' }}>frank</div>
        <div style={{ fontSize: 8, color: C.muted, letterSpacing: 3, textTransform: 'uppercase', marginTop: 1 }}>Finance AI · South Africa</div>
      </div>

      {/* Business info */}
      <div style={{ padding: '11px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{BUSINESS.name}</div>
        <div style={{ fontSize: 9, color: C.sub, marginTop: 1 }}>{BUSINESS.sector}</div>
        <div style={{ fontSize: 9, color: C.sub, marginTop: 1 }}>{BUSINESS.children} learners · {BUSINESS.staff} staff</div>
        <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="blink" style={{ width: 5, height: 5, borderRadius: '50%', background: C.frank }} />
            <span style={{ fontSize: 9, color: C.frank }}>Bank statement uploaded</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.warn }} />
            <span style={{ fontSize: 9, color: C.warn }}>No accounting software</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: view === n.id ? C.frankDim : 'transparent',
            color: view === n.id ? C.frank : C.sub,
            fontSize: 11, fontWeight: view === n.id ? 600 : 400,
            marginBottom: 1, textAlign: 'left',
          }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{n.icon}</span>
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.badge != null && (
              <span style={{ fontSize: 9, background: `${n.badgeColor}22`, color: n.badgeColor, borderRadius: 10, padding: '1px 6px', fontWeight: 700, border: `1px solid ${n.badgeColor}44` }}>
                {n.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Plan */}
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 9, color: C.muted }}>{BUSINESS.plan} · R {BUSINESS.planPrice}/mo</div>
        <button onClick={() => onAsk('What would I get if I upgraded Wonderland to the Growth plan?')}
          style={{ marginTop: 5, width: '100%', padding: '5px', borderRadius: 4, border: `1px solid ${C.frank}44`, background: C.frankDim, color: C.frank, fontSize: 9, cursor: 'pointer', fontWeight: 600 }}>
          Upgrade → R 999
        </button>
      </div>
    </aside>
  )
}
