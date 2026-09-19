import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { C, fmt } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'

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

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: d.color, fontWeight: 700 }}>{d.name}</div>
      <div style={{ color: C.text }}>{fmt(d.value)}</div>
      <div style={{ color: C.dim }}>{d.pct}% of expenses</div>
    </div>
  )
}


export function Reports({ onAsk }) {
  const { data } = useTenant()
  const { MONTHLY, EXPENSES } = data
  const [selectedIdx, setSelectedIdx] = useState(MONTHLY.length - 1)
  const m    = MONTHLY[selectedIdx]
  const prev = MONTHLY[selectedIdx - 1]
  const profitColor = m.net > 10000 ? C.frank : m.net > 0 ? C.warn : C.danger
  const revDelta = prev ? m.rev - prev.rev : null
  const expDelta = prev ? m.exp - prev.exp : null
  const margin   = m.rev > 0 ? ((m.net / m.rev) * 100).toFixed(1) : '0.0'

  return (
    <div className="fade-up" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Monthly Report</div>
          <div style={{ fontSize: 13, color: C.sub }}>What came in, what went out, and what's left — one month at a time.</div>
        </div>

        {/* Month selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase' }}>Select month:</div>
          <select
            value={selectedIdx}
            onChange={e => setSelectedIdx(Number(e.target.value))}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
              padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--mono)',
            }}>
            {MONTHLY.map((mo, i) => (
              <option key={mo.m} value={i}>{mo.m} {i <= 5 ? '2025' : '2026'}</option>
            ))}
          </select>
          {m.net < 0 && (
            <span style={{ padding: '4px 10px', background: `${C.danger}15`, color: C.danger, borderRadius: 4, fontSize: 11, fontWeight: 700 }}>LOSS MONTH</span>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: '#0a1828' }}>

        {/* ── Section 1: The Bottom Line ───────────────────── */}
        <Section title={`${m.m} — The Bottom Line`} subtitle="Income minus spending equals your profit or loss for the month">
          <div style={{ display: 'flex', gap: 14 }}>

            {/* Income */}
            <div style={{ flex: 1, background: '#0a1828', border: `1px solid ${C.frank}25`, borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, background: C.frank, borderRadius: 2, marginRight: 6 }} />
                Money That Came In
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.frank, fontFamily: 'var(--mono)', lineHeight: 1 }}>{fmt(m.rev)}</div>
              {revDelta !== null && (
                <div style={{ fontSize: 12, color: revDelta >= 0 ? C.frank : C.danger, marginTop: 6, fontWeight: 600 }}>
                  {revDelta >= 0 ? '▲' : '▼'} {fmt(Math.abs(revDelta))} vs last month
                </div>
              )}
              <div style={{ marginTop: 14, padding: '12px 14px', background: C.card, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Breakdown</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: C.sub }}>{m.subsidy > 0 ? 'Fee income' : 'Sales revenue'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'var(--mono)' }}>{fmt(m.fees)}</span>
                </div>
                {m.subsidy > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.sub }}>Subsidy / grants</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'var(--mono)' }}>{fmt(m.subsidy)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: m.subsidy > 0 ? 8 : 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.frank }}>Total income</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.frank, fontFamily: 'var(--mono)' }}>{fmt(m.rev)}</span>
                </div>
              </div>
            </div>

            {/* Spending */}
            <div style={{ flex: 1, background: '#0a1828', border: `1px solid ${C.danger}25`, borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, background: C.danger, borderRadius: 2, marginRight: 6 }} />
                Money That Went Out
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.danger, fontFamily: 'var(--mono)', lineHeight: 1 }}>{fmt(m.exp)}</div>
              {expDelta !== null && (
                <div style={{ fontSize: 12, color: expDelta <= 0 ? C.frank : C.danger, marginTop: 6, fontWeight: 600 }}>
                  {expDelta >= 0 ? '▲' : '▼'} {fmt(Math.abs(expDelta))} vs last month
                </div>
              )}
              <div style={{ marginTop: 14, padding: '12px 14px', background: C.card, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Breakdown</div>
                {EXPENSES.map(ex => (
                  <div key={ex.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: ex.color }} />
                      <span style={{ fontSize: 12, color: C.sub }}>{ex.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: C.dim }}>{ex.pct}%</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: 'var(--mono)', minWidth: 72, textAlign: 'right' }}>{fmt(ex.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Result */}
            <div style={{ width: 190, background: '#0a1828', border: `1px solid ${profitColor}30`, borderRadius: 8, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                {m.net >= 0 ? 'Profit' : 'Loss'}
              </div>
              <div style={{ fontSize: 38, fontWeight: 800, color: profitColor, fontFamily: 'var(--mono)', lineHeight: 1 }}>
                {m.net < 0 ? '-' : ''}{fmt(Math.abs(m.net))}
              </div>
              <div style={{ width: '80%', height: 1, background: C.border, margin: '14px 0' }} />
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                {m.net >= 0
                  ? `You kept ${margin} cents for every rand earned`
                  : 'You spent more than you earned'}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: C.dim }}>Profit margin: {margin}%</div>
              <div style={{ marginTop: 6, fontSize: 11, color: C.dim }}>Cash in bank: {fmt(m.cash)}</div>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Where Did the Money Go? ───────────── */}
        <Section title="Where Did the Money Go?" subtitle="A visual breakdown of every expense category this month">
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <div style={{ flexShrink: 0 }}>
              <ResponsiveContainer width={200} height={180}>
                <PieChart>
                  <Pie data={EXPENSES} cx="50%" cy="50%" innerRadius={44} outerRadius={78} dataKey="value" labelLine={false}>
                    {EXPENSES.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {EXPENSES.map(ex => (
                  <div key={ex.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: ex.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, color: C.sub }}>{ex.name}</div>
                    <div style={{ fontSize: 13, color: C.dim, width: 36, textAlign: 'right' }}>{ex.pct}%</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'var(--mono)', width: 90, textAlign: 'right' }}>{fmt(ex.value)}</div>
                    <div style={{ width: 100, height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${ex.pct}%`, height: '100%', background: ex.color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
              {(() => {
                const staffEx = EXPENSES.find(e => /staff|wage|salary|salari/i.test(e.name || ''))
                if (!staffEx) return null
                const over = staffEx.pct - 45
                const color = over > 8 ? C.danger : over > 0 ? C.warn : C.frank
                const msg = over > 8
                  ? `${staffEx.name} is ${staffEx.pct}% of expenses — ${over}% above the 45% industry target.`
                  : over > 0
                  ? `${staffEx.name} is ${staffEx.pct}% of expenses — slightly above the 45% industry target.`
                  : `${staffEx.name} is ${staffEx.pct}% of expenses — within the industry benchmark. ✓`
                return (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 6 }}>
                    <div style={{ fontSize: 12, color: C.sub }}>
                      <strong style={{ color }}>{msg}</strong>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </Section>

        {/* ── Section 3: 12-Month Profit Trend ─────────────── */}
        <Section title="Profit Trend — 12 Months" subtitle="How your monthly profit has changed over the year. Each bar = one month. White bar = the month you're viewing.">
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 70 }}>
            {MONTHLY.map((mo, i) => {
              const maxAbs = Math.max(...MONTHLY.map(x => Math.abs(x.net)))
              const h = Math.max(4, Math.round((Math.abs(mo.net) / maxAbs) * 60))
              const col = mo.net > 10000 ? C.frank : mo.net > 0 ? C.warn : C.danger
              return (
                <div key={mo.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  onClick={() => setSelectedIdx(i)}>
                  <div style={{ width: '100%', height: h, background: i === selectedIdx ? '#ffffff' : col, borderRadius: '3px 3px 0 0', opacity: i === selectedIdx ? 1 : 0.6, transition: 'all .25s' }} />
                  <div style={{ fontSize: 9, color: i === selectedIdx ? C.frank : C.dim, fontWeight: i === selectedIdx ? 700 : 400 }}>{mo.m}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            {[
              { color: C.frank,   label: 'Good month (over R 10k profit)' },
              { color: C.warn,    label: 'Tight month (some profit)' },
              { color: C.danger,  label: 'Loss month' },
              { color: '#ffffff', label: 'Selected month' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, border: l.color === '#ffffff' ? `1px solid ${C.border}` : 'none' }} />
                <span style={{ fontSize: 11, color: C.dim }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 4: Zeeder's Take ─────────────────────── */}
        <Section title={`Zeeder's Take on ${m.m}`} subtitle="What the numbers mean for your business" accent={C.frank}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8, flex: 1 }}>
              {m.take ?? `In ${m.m}, income was ${fmt(m.rev)} and expenses were ${fmt(m.exp)}, leaving a ${m.net >= 0 ? 'profit' : 'loss'} of ${fmt(Math.abs(m.net))}.`}
            </div>
            <button
              onClick={() => onAsk(`Explain ${m.m}'s financial results to me in simple terms — what happened, why, and what should I do about it?`)}
              style={{ padding: '12px 20px', borderRadius: 6, border: `1px solid ${C.frank}40`, background: C.frankMid, color: C.frank, fontSize: 13, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Explain {m.m} to me →
            </button>
          </div>
        </Section>

      </div>
    </div>
  )
}
