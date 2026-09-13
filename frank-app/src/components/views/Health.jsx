import { useState } from 'react'
import { C } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'

const PLAIN_TITLES = {
  cf:  'Do you have enough cash coming in?',
  fee: 'Are you collecting the money you\'re owed?',
  stf: 'Are your salary costs in line?',
  run: 'How long can the business survive without new income?',
  cmp: 'Are your licences and registrations up to date?',
}

const STATUS_LABELS = { good: 'Good', warn: 'Needs attention', bad: 'Action needed now' }

function Section({ title, subtitle, children, accent }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.card }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: accent ? `${accent}08` : 'transparent' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  )
}

function HealthCard({ check, onAsk }) {
  const color = check.status === 'good' ? C.frank : check.status === 'warn' ? C.warn : C.danger
  const bm = check.benchmark || null
  return (
    <div style={{ border: `1px solid ${color}25`, borderTop: `3px solid ${color}`, borderRadius: 8, padding: '18px 20px', background: '#0a1828' }}>

      {/* Card title + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, marginRight: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 6 }}>
            {PLAIN_TITLES[check.id] ?? check.label}
          </div>
          <span style={{
            padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: 1,
            background: `${color}15`, color, border: `1px solid ${color}30`,
          }}>{STATUS_LABELS[check.status]}</span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color, fontFamily: 'var(--mono)', lineHeight: 1 }}>{check.score}</div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>out of 100</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ width: `${check.score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .6s ease' }} />
      </div>

      {/* What this means */}
      <div style={{ marginBottom: 12, padding: '10px 14px', background: C.card, borderRadius: 6, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>What This Means</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{check.message}</div>
      </div>

      {/* Benchmark comparison */}
      {bm && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: C.card, borderRadius: 6, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>How You Compare to the Target</div>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ flex: 1, paddingRight: 12, borderRight: `1px solid ${C.border}`, marginRight: 12 }}>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>Your rate</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: bm.warn ? C.danger : C.frank, fontFamily: 'var(--mono)' }}>{bm.actual}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>Target</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.frank, fontFamily: 'var(--mono)' }}>{bm.target}</div>
            </div>
          </div>
        </div>
      )}

      {/* What to do */}
      <div style={{ marginBottom: 14, padding: '10px 14px', background: `${color}08`, borderRadius: 6, border: `1px solid ${color}20` }}>
        <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>What To Do</div>
        <div style={{ fontSize: 13, color, fontWeight: 600, lineHeight: 1.5 }}>→ {check.action}</div>
      </div>

      <button
        onClick={() => onAsk(`Explain "${PLAIN_TITLES[check.id] ?? check.label}" in simple terms and give me a step-by-step action plan`)}
        style={{ width: '100%', padding: '9px', borderRadius: 5, border: `1px solid ${color}25`, background: `${color}08`, color, fontSize: 11, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
        Ask Zeeder to explain and help →
      </button>
    </div>
  )
}

export function Health({ onAsk }) {
  const { data } = useTenant()
  const { HEALTH_CHECKS } = data
  const [statusFilter, setStatusFilter] = useState(null)
  const overallScore = Math.round(HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / HEALTH_CHECKS.length)
  const scoreColor   = overallScore > 75 ? C.frank : overallScore > 50 ? C.warn : C.danger

  const issues = HEALTH_CHECKS.filter(h => h.status !== 'good').length
  const highPriority = HEALTH_CHECKS.filter(h => h.priority === 'HIGH')
  const visibleChecks = statusFilter ? HEALTH_CHECKS.filter(h => h.status === statusFilter) : HEALTH_CHECKS

  return (
    <div className="fade-up" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Business Health Check</div>
        <div style={{ fontSize: 13, color: C.sub }}>How is your business doing — and what do you need to do about it? Six key areas, in plain English.</div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: '#0a1828' }}>

        {/* ── Section 1: Overall Score ──────────────────────── */}
        <Section title="Your Overall Health Score" subtitle="A score out of 100 across 6 key areas of your business">
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {/* Big score */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 80, fontWeight: 800, color: scoreColor, fontFamily: 'var(--mono)', lineHeight: 1 }}>{overallScore}</div>
              <div style={{ fontSize: 14, color: C.dim, marginTop: 4 }}>out of 100</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: C.text, marginBottom: 12, lineHeight: 1.6 }}>
                {overallScore > 75
                  ? 'Your business is in good shape overall. Keep doing what\'s working.'
                  : overallScore > 50
                    ? `Your business is running but under pressure. ${issues} area${issues !== 1 ? 's' : ''} need${issues === 1 ? 's' : ''} your attention.`
                    : `Your business needs urgent attention in ${issues} areas. See the action steps below.`}
              </div>

              {/* Score breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { status: 'good', label: 'Areas doing well', count: HEALTH_CHECKS.filter(h => h.status === 'good').length, color: C.frank },
                  { status: 'warn', label: 'Need attention',   count: HEALTH_CHECKS.filter(h => h.status === 'warn').length, color: C.warn },
                  { status: 'bad',  label: 'Act now',          count: HEALTH_CHECKS.filter(h => h.status === 'bad').length,  color: C.danger },
                ].map(row => {
                  const active = statusFilter === row.status
                  return (
                    <button
                      key={row.label}
                      onClick={() => setStatusFilter(active ? null : row.status)}
                      title={active ? 'Click to clear filter' : `Show only "${row.label}" in the breakdown below`}
                      style={{
                        padding: '10px 14px', background: `${row.color}${active ? '20' : '10'}`, borderRadius: 6,
                        border: `1px solid ${row.color}${active ? '70' : '25'}`, textAlign: 'center', cursor: 'pointer',
                        font: 'inherit', transition: 'all .15s',
                      }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: row.color, fontFamily: 'var(--mono)' }}>{row.count}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{row.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 2: High Priority Actions ──────────────── */}
        {highPriority.length > 0 && (
          <Section title="High Priority — Act This Month" subtitle="These three areas have the biggest impact on your business right now">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {highPriority.map(check => {
                const color = check.status === 'good' ? C.frank : check.status === 'warn' ? C.warn : C.danger
                return (
                  <div key={check.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', borderRadius: 6, border: `1px solid ${color}25`,
                    borderLeft: `4px solid ${color}`, background: `${color}06`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{PLAIN_TITLES[check.id] ?? check.label}</div>
                      <div style={{ fontSize: 12, color: color, fontWeight: 600 }}>→ {check.action}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'var(--mono)', flexShrink: 0 }}>{check.score}</div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Section 3: All Health Cards ───────────────────── */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.card }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Detailed Health Breakdown</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                {statusFilter ? `Showing "${STATUS_LABELS[statusFilter]}" only` : 'Each of the 6 areas explained — what it means and what to do'}
              </div>
            </div>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                style={{ padding: '6px 12px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, fontSize: 11, cursor: 'pointer' }}>
                Clear filter ×
              </button>
            )}
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {visibleChecks.map(check => (
              <HealthCard key={check.id} check={check} onAsk={onAsk} />
            ))}
          </div>
        </div>

        {/* ── Section 4: Zeeder's Assessment ───────────────── */}
        <Section title="Zeeder's Business Assessment" subtitle="What all of this means for you, in plain English" accent={C.frank}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8, flex: 1 }}>
              Your score of <strong style={{ color: scoreColor }}>{overallScore}/100</strong>{' '}
              {overallScore > 75
                ? 'means your business is in good shape. Keep doing what\'s working and monitor the areas flagged above.'
                : overallScore > 50
                  ? `means the business is running but under pressure. ${issues} area${issues !== 1 ? 's' : ''} need${issues === 1 ? 's' : ''} your attention — focus on the HIGH priority items first.`
                  : `means your business needs urgent attention. ${issues} areas are under strain. Start with the HIGH priority actions above.`
              }
            </div>
            <button
              onClick={() => onAsk('Give me a complete health assessment for my business with a priority action list — keep it simple and practical')}
              style={{ padding: '12px 20px', borderRadius: 6, border: `1px solid ${C.frank}40`, background: C.frankMid, color: C.frank, fontSize: 13, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Full assessment →
            </button>
          </div>
        </Section>

      </div>
    </div>
  )
}
