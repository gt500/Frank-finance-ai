import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { C, fmt } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'

const DANGER_THRESHOLD = 40000
const CAUTION_THRESHOLD = 80000

function barColor(balance) {
  if (balance < DANGER_THRESHOLD) return C.danger
  if (balance < CAUTION_THRESHOLD) return C.warn
  return C.frank
}

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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: C.frank, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ color: C.text }}>Balance: {fmt(d.balance)}</div>
      <div style={{ color: C.sub }}>In: {fmt(d.inflow)} · Out: {fmt(d.outflow)}</div>
      {d.salary && <div style={{ color: C.danger, marginTop: 4 }}>⚠ Salary week</div>}
      {d.subsidy && <div style={{ color: C.frank, marginTop: 4 }}>✓ Subsidy week</div>}
    </div>
  )
}

export function CashFlow({ onAsk }) {
  const { data } = useTenant()
  const { MONTHLY, WEEKLY_FORECAST, CASHFLOW_FLAGS } = data

  const currentCash = MONTHLY[MONTHLY.length - 1].cash
  const cashColor   = currentCash < DANGER_THRESHOLD ? C.danger : currentCash < CAUTION_THRESHOLD ? C.warn : C.frank
  const cashStatus  = currentCash < DANGER_THRESHOLD
    ? '⚠️ Cash is dangerously low — action needed now'
    : currentCash < CAUTION_THRESHOLD
      ? '⚠️ Cash is tight — watch your spending this week'
      : '✅ Cash looks healthy for now'
  const chartData   = WEEKLY_FORECAST.map(w => ({ ...w, dotColor: barColor(w.balance) }))

  const highFlag  = CASHFLOW_FLAGS.find(f => f.severity === 'HIGH' && f.impact < 0)
  const totalAR   = data.DEBTORS.reduce((s, d) => s + d.amount, 0)
  const arCount   = data.DEBTORS.length
  const nextBill  = data.CREDITORS.sort((a, b) => a.daysLeft - b.daysLeft)[0]

  return (
    <div className="fade-up" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Cash Flow</div>
        <div style={{ fontSize: 13, color: C.sub }}>Will you have enough money to pay your bills? Here's your cash position for the next 13 weeks.</div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: '#0a1828' }}>

        {/* ── Section 1: Current Position ───────────────────── */}
        <Section title="Your Cash Position Today" subtitle="How much you have, what you owe to others, and what others owe you">
          <div style={{ display: 'flex', gap: 14 }}>
            {/* Cash balance */}
            <div style={{ flex: 2, background: '#0a1828', border: `1px solid ${cashColor}30`, borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Cash in the Bank Right Now</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: cashColor, fontFamily: 'var(--mono)', letterSpacing: '-1px', lineHeight: 1 }}>{fmt(currentCash)}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 10, fontWeight: 600 }}>{cashStatus}</div>
              {highFlag && (
                <div style={{ fontSize: 12, color: C.dim, marginTop: 6, lineHeight: 1.6 }}>
                  {highFlag.detail}
                </div>
              )}
            </div>

            {/* Two small KPIs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              {arCount > 0 && (
                <div style={{ flex: 1, background: '#0a1828', border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px' }}>
                  <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Money Owed to You</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: C.warn, fontFamily: 'var(--mono)' }}>{fmt(totalAR)}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{arCount} {arCount === 1 ? 'customer has' : 'customers have'} not paid</div>
                </div>
              )}
              {nextBill && (
                <div style={{ flex: 1, background: '#0a1828', border: `1px solid ${nextBill.overdue ? C.danger : C.border}30`, borderRadius: 8, padding: '16px 18px' }}>
                  <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>{nextBill.overdue ? 'Bill Overdue' : 'Next Bill Due'}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: nextBill.overdue ? C.danger : C.warn, fontFamily: 'var(--mono)' }}>{fmt(nextBill.amount)}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{nextBill.name} · due {nextBill.due}</div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── Section 2: 13-Week Chart ──────────────────────── */}
        <Section title="Cash Balance — Next 13 Weeks" subtitle="See when your cash goes up and when it drops. Red = take action, Amber = watch closely, Green = healthy.">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.frank} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={C.frank} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="wk" tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R${(v/1000).toFixed(0)}k`} width={46} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={DANGER_THRESHOLD} stroke={C.danger} strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Danger', fill: C.danger, fontSize: 9 }} />
              <ReferenceLine y={CAUTION_THRESHOLD} stroke={C.warn} strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: 'Watch', fill: C.warn, fontSize: 9 }} />
              <Area type="monotone" dataKey="balance" stroke={C.frank} strokeWidth={2} fill="url(#cashGrad)"
                dot={(p) => {
                  const color = barColor(p.payload.balance)
                  return <circle key={p.key} cx={p.cx} cy={p.cy} r={4} fill={color} stroke={C.bg} strokeWidth={1.5} />
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 22, marginTop: 12 }}>
            {[
              { color: C.danger, label: 'Danger zone — under R 40,000' },
              { color: C.warn,   label: 'Watch zone — under R 80,000' },
              { color: C.frank,  label: 'Healthy' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 24, height: 2, background: l.color, borderRadius: 1 }} />
                <span style={{ fontSize: 11, color: C.dim }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 3: Upcoming Cash Events ──────────────── */}
        <Section title="Upcoming Cash Events" subtitle="Things that will affect your bank balance in the coming weeks — and what you should do about them">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CASHFLOW_FLAGS.map(flag => (
              <div key={flag.id} style={{
                padding: '14px 18px',
                background: `${flag.color}07`,
                border: `1px solid ${flag.color}20`,
                borderLeft: `4px solid ${flag.color}`,
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: flag.color, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 6px', background: `${flag.color}15`, borderRadius: 3 }}>{flag.severity}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{flag.title}</span>
                      {flag.nextDate && <span style={{ fontSize: 11, color: C.dim }}>— {flag.nextDate}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 6 }}>
                      <strong style={{ color: C.dim }}>What this means: </strong>{flag.detail}
                    </div>
                    <div style={{ fontSize: 12, color: flag.color, fontWeight: 600 }}>
                      <strong>What to do: </strong>{flag.action}
                    </div>
                  </div>
                  <button
                    onClick={() => onAsk(`Help me understand and deal with: ${flag.title}`)}
                    style={{ padding: '7px 14px', borderRadius: 4, border: `1px solid ${flag.color}30`, background: `${flag.color}10`, color: flag.color, fontSize: 11, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Ask Zeeder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 4: Zeeder's Summary ──────────────────── */}
        <Section title="Zeeder's Cash Summary" subtitle="Plain-English summary of your current cash situation" accent={C.frank}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8, flex: 1 }}>
              You have <strong style={{ color: C.frank }}>{fmt(currentCash)}</strong> in the bank today.
              {highFlag && (
                <> {highFlag.action}</>
              )}
              {CASHFLOW_FLAGS.filter(f => f.severity === 'MED').slice(0, 1).map(f => (
                <span key={f.id}> {f.detail}</span>
              ))}
            </div>
            <button
              onClick={() => onAsk('Help me plan my cash for next month — what do I need to do this week to avoid running short?')}
              style={{ padding: '12px 20px', borderRadius: 6, border: `1px solid ${C.frank}40`, background: C.frankMid, color: C.frank, fontSize: 13, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Help me plan cash →
            </button>
          </div>
        </Section>

      </div>
    </div>
  )
}
