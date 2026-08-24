import { C, fmt, fmtK } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'

function KPI({ label, value, delta, color, sub, meaning }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderTop: `2px solid ${color}`, borderRadius: 6,
      padding: '16px 18px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 9 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'var(--mono)', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{ fontSize: 11, color: delta >= 0 ? C.frank : C.danger, marginTop: 4, fontWeight: 600 }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('en-ZA')} vs last month
        </div>
      )}
      {meaning && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
          {meaning}
        </div>
      )}
    </div>
  )
}

function AlertRow({ flag, onAsk }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14,
      padding: '13px 16px',
      background: `${flag.color}08`,
      border: `1px solid ${flag.color}25`,
      borderLeft: `3px solid ${flag.color}`,
      borderRadius: 5,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: flag.color, marginBottom: 4 }}>{flag.title}</div>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{flag.action}</div>
      </div>
      <button onClick={() => onAsk(`Tell me more about: ${flag.title}`)}
        style={{
          padding: '6px 13px', borderRadius: 3, border: `1px solid ${flag.color}30`,
          background: `${flag.color}10`, color: flag.color,
          fontSize: 11, cursor: 'pointer', fontWeight: 700, letterSpacing: 1,
          textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
        Ask Zeeder
      </button>
    </div>
  )
}

function HealthRow({ check }) {
  const color = check.status === 'good' ? C.frank : check.status === 'warn' ? C.warn : C.danger
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: C.text }}>{check.label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{check.score}</span>
      </div>
      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${check.score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

function MonthBar({ month, maxRev }) {
  const revH = maxRev > 0 ? Math.round((month.rev / maxRev) * 56) : 0
  const expH = maxRev > 0 ? Math.round((month.exp / maxRev) * 56) : 0
  const pos  = month.net >= 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 60 }}>
        <div style={{ width: 10, height: revH, background: C.teal, borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
        <div style={{ width: 10, height: expH, background: pos ? C.deepTeal : C.danger, borderRadius: '2px 2px 0 0', opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 11, color: C.dim, letterSpacing: 0.5 }}>{month.m}</div>
    </div>
  )
}

export function Dashboard({ onAsk, liveData, loading }) {
  const { tenant, data } = useTenant()
  const { MONTHLY, HEALTH_CHECKS, CASHFLOW_FLAGS, DEBTORS, BRIEFING } = data

  const staticLatest  = MONTHLY[MONTHLY.length - 1] || { m:'—', rev:0, exp:0, net:0, cash:0, fees:0, subsidy:0 }
  const staticPrev    = MONTHLY[MONTHLY.length - 2] || staticLatest
  const hScore        = Math.round(HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / HEALTH_CHECKS.length)
  const highFlags     = CASHFLOW_FLAGS.filter(f => f.severity === 'HIGH')
  const staticTotalAR = DEBTORS.reduce((s, d) => s + d.amount, 0)
  const maxRev        = Math.max(...MONTHLY.map(m => m.rev))

  const s        = liveData?.summary
  const liveRev  = s?.collected ?? s?.expected_revenue ?? staticLatest.rev
  const learners = s?.learner_counts ?? liveData?.children?.length
  const totalAR  = s?.total_outstanding ?? staticTotalAR
  const revenue  = liveData ? liveRev : staticLatest.rev
  const arCount  = liveData?.children?.length ?? DEBTORS.length

  const briefingDotColor = (sev) => sev === 'high' ? C.danger : C.warn

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Daily Briefing ────────────────────────────────────── */}
      <div style={{ background: `${C.frank}08`, border: `1px solid ${C.frank}25`, borderRadius: 6, padding: '18px 22px' }}>
        <div style={{ fontSize: 11, color: C.frank, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Today's Briefing</div>
        <div style={{ fontSize: 14, color: C.sub, marginBottom: 12 }}>Here's what matters today at {tenant.name}:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BRIEFING.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
              <span style={{ color: briefingDotColor(b.severity), flexShrink: 0 }}>•</span>
              <span>{b.text}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => onAsk('What are the most important things I need to do today to keep my business healthy?')}
          style={{ marginTop: 14, padding: '8px 18px', borderRadius: 5, border: `1px solid ${C.frank}40`, background: C.frankMid, color: C.frank, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
          Ask Zeeder what to do today →
        </button>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, color: C.dim, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Your Numbers at a Glance</div>
        <div style={{ display: 'flex', gap: 14 }}>
          <KPI
            label="Cash in the Bank"
            value={fmtK(staticLatest.cash)}
            color={C.frank}
            sub={`${tenant.bank} · as at ${staticLatest.m}`}
          />
          <KPI
            label="Money Coming In"
            value={loading ? '…' : fmtK(revenue)}
            delta={staticLatest.rev - staticPrev.rev}
            color={C.teal}
            sub={liveData ? 'Live · this month' : 'Total revenue this month'}
          />
          <KPI
            label="Profit This Month"
            value={fmt(staticLatest.net)}
            delta={staticLatest.net - staticPrev.net}
            color={staticLatest.net > 10000 ? C.frank : staticLatest.net > 0 ? C.warn : C.danger}
            sub={staticLatest.net < 5000 ? 'Below target — action needed' : 'On track'}
          />
          <KPI
            label="Business Health"
            value={`${hScore} / 100`}
            color={hScore > 75 ? C.frank : hScore > 55 ? C.warn : C.danger}
            sub={learners ? `${learners} active ${tenant.children != null ? 'learners' : 'staff'}` : `${HEALTH_CHECKS.filter(h => h.status !== 'good').length} areas need action`}
          />
          {DEBTORS.length > 0 && (
            <KPI
              label="Money Owed to You"
              value={loading ? '…' : fmtK(totalAR)}
              color={C.warn}
              sub={loading ? 'Loading…' : `${arCount} ${arCount === 1 ? 'customer' : 'customers'} outstanding`}
            />
          )}
        </div>
      </div>

      {/* ── Priority actions ──────────────────────────────────── */}
      {highFlags.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Priority Actions — Do These First</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {highFlags.map(f => <AlertRow key={f.id} flag={f} onAsk={onAsk} />)}
          </div>
        </div>
      )}

      {/* ── Bottom row ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14 }}>

        {/* Revenue trend */}
        <div style={{ flex: 2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Income vs Spending — 12 Months</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>The gap between income (teal) and spending (blue) is shrinking — that's the margin squeeze.</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            {MONTHLY.map(m => <MonthBar key={m.m} month={m} maxRev={maxRev} />)}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 9, height: 9, background: C.teal, borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: C.dim }}>Income</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 9, height: 9, background: C.deepTeal, borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: C.dim }}>Spending</span>
            </div>
          </div>
        </div>

        {/* Health checks */}
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Business Health Overview</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>100 = perfect. Under 50 = needs urgent action.</div>
          {HEALTH_CHECKS.map(h => <HealthRow key={h.id} check={h} />)}
          <button onClick={() => onAsk(`Give me a complete health assessment for ${tenant.name} with specific actions`)}
            style={{
              marginTop: 6, width: '100%', padding: '8px', borderRadius: 4,
              border: `1px solid ${C.frank}25`, background: C.frankDim,
              color: C.frank, fontSize: 11, cursor: 'pointer', fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
            Full Health Report →
          </button>
        </div>
      </div>
    </div>
  )
}
