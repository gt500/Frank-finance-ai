import { useState } from 'react'
import { C, CHART, fmt, fmtK } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'
import { HBarChart, Legend } from '../charts/HBarChart'
import { Sparkline, Donut } from '../charts/MiniCharts'
import { safetyBuffer } from '../../lib/monthlyHistory'

const MONTH_NAMES = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }
const monthKey = (m, i) => `${m.m}-${m.y ?? ''}-${i}`
const monthName = (m) => `${MONTH_NAMES[String(m.m).slice(0, 3)] ?? m.m}${m.y ? ' ' + m.y : ''}`
const hasData = (m) => (m.rev || 0) > 0 || (m.exp || 0) > 0
const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : 0)

function Kpi({ label, value, delta, deltaUp, series, color, note }) {
  const tone = deltaUp ? C.frank : C.watch
  return (
    <div className="glass" style={{ padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', color: C.label }}>{label}</span>
        {delta && <span className="num nowrap" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, color: tone, background: `${tone}1c` }}>{delta}</span>}
      </div>
      <div className="num nowrap" style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.5px', color: C.bright }}>{value}</div>
      {series && <Sparkline values={series} color={color} />}
      {note && <div style={{ fontSize: 12, color: C.label }}>{note}</div>}
    </div>
  )
}

function deltaText(cur, prev) {
  if (!prev) return null
  const d = pct(cur, prev)
  return { text: `${d >= 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}%`, up: d >= 0 }
}

export function Dashboard({ onAsk, liveData, loading }) {
  const { tenant, data } = useTenant()
  const { MONTHLY = [], HEALTH_CHECKS = [], CASHFLOW_FLAGS = [], DEBTORS = [], CREDITORS = [], BRIEFING = [], EXPENSES = [], WEEKLY_FORECAST = [] } = data
  const [range, setRange] = useState(12)
  const [selKey, setSelKey] = useState(null)

  const withData = MONTHLY.filter(hasData)
  const latest = withData[withData.length - 1] || MONTHLY[MONTHLY.length - 1] || { m: '—', rev: 0, exp: 0, net: 0, cash: 0 }
  const prev = withData[withData.length - 2]
  const hScore = HEALTH_CHECKS.length ? Math.round(HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / HEALTH_CHECKS.length) : 0
  const revenue = liveData ? (liveData.summary?.collected ?? liveData.summary?.expected_revenue ?? latest.rev) : latest.rev
  const totalAR = liveData?.summary?.total_outstanding ?? DEBTORS.reduce((s, d) => s + (d.amount || 0), 0)

  // ── KPIs ──
  const cashD = deltaText(latest.cash, prev?.cash), revD = deltaText(latest.rev, prev?.rev), netD = deltaText(latest.net, prev?.net)
  const margin = latest.rev ? (latest.net / latest.rev) * 100 : 0

  // ── Revenue vs expenses (months down the Y axis) ──
  const indexed = MONTHLY.map((m, i) => ({ ...m, key: monthKey(m, i) }))
  const shown = range === 6 ? indexed.slice(-6) : indexed
  const selectable = indexed.filter(hasData)
  const selected = selectable.find((m) => m.key === selKey) || selectable[selectable.length - 1]
  const monthRows = shown.map((m) => ({
    key: m.key, label: String(m.m).slice(0, 3), sub: m.y ? String(m.y) : '',
    none: hasData(m) ? null : "No data — upload this month's bank statement",
    bars: [
      { value: m.rev, color: CHART.s1, text: fmt(m.rev), tip: `${monthName(m)} revenue: ${fmt(m.rev)}` },
      { value: m.exp, color: CHART.s2, text: fmt(m.exp), tip: `${monthName(m)} expenses: ${fmt(m.exp)}` },
    ],
    side: { value: m.net, text: `Net profit ${fmt(m.net)}`, tip: `${monthName(m)} net profit: ${fmt(m.net)}` },
  }))

  // ── Cash forecast (weeks down the Y axis) ──
  const buffer = safetyBuffer(MONTHLY)
  const weekRows = WEEKLY_FORECAST.map((w, i) => {
    const low = buffer > 0 && w.balance < buffer
    return {
      key: `${w.wk}-${i}`, label: `Week ${i + 1}`, sub: w.wk,
      bars: [{ value: w.balance, color: low ? 'rgba(11,157,179,0.30)' : CHART.s1, stroke: low ? C.watch : undefined,
        text: low ? `${fmtK(w.balance)} · below buffer` : fmtK(w.balance), textColor: low ? '#F7E7C2' : undefined, bold: low,
        tip: `Week ${i + 1} (${w.wk}): ${fmt(w.balance)}${low ? ' — below safety buffer' : ''}` }],
    }
  })
  const lowestWeek = WEEKLY_FORECAST.reduce((lo, w, i) => (lo == null || w.balance < WEEKLY_FORECAST[lo].balance ? i : lo), null)

  // ── Expense split: top 3 + Other, fixed palette order ──
  const exp = [...EXPENSES].filter((e) => e.value > 0).sort((a, b) => b.value - a.value)
  const palette = [CHART.s1, CHART.s2, CHART.s3]
  const segments = exp.slice(0, 3).map((e, i) => ({ name: e.name, value: e.value, color: palette[i] }))
  const otherTotal = exp.slice(3).reduce((a, e) => a + e.value, 0)
  if (otherTotal > 0) segments.push({ name: 'Other', value: otherTotal, color: CHART.other })
  const expTotal = segments.reduce((a, s) => a + s.value, 0)

  // ── Bills ──
  const bills = [...CREDITORS].sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 4)
  const highFlags = CASHFLOW_FLAGS.filter((f) => f.severity === 'HIGH')

  const seg = (on) => ({ minHeight: 34, padding: '0 12px', borderRadius: 8, border: 'none', fontSize: 12.5, cursor: 'pointer', background: on ? 'rgba(32,229,246,0.16)' : 'transparent', color: on ? C.frank : C.soft })

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section aria-label="Key figures" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        <Kpi label="Cash on hand" value={fmt(latest.cash)} delta={cashD?.text} deltaUp={cashD?.up} series={withData.map((m) => m.cash)} color={CHART.s1}
          note={`${tenant.bank || 'Bank'} · as at ${monthName(latest)}`} />
        <Kpi label={`Revenue · ${String(latest.m).slice(0, 3)}`} value={loading ? '…' : fmt(revenue)} delta={revD?.text} deltaUp={revD?.up} series={withData.map((m) => m.rev)} color={CHART.s1}
          note={liveData ? 'Live from your system' : 'From your bank statement'} />
        <Kpi label={`Net profit · ${String(latest.m).slice(0, 3)}`} value={fmt(latest.net)} delta={netD?.text} deltaUp={netD?.up} series={withData.map((m) => m.net)} color={C.gold}
          note={latest.rev ? `${margin.toFixed(1)}% margin` : 'Upload a statement to calculate'} />
        <Kpi label="Business health" value={`${hScore} / 100`} color={C.gold}
          note={`${HEALTH_CHECKS.filter((h) => h.status !== 'good').length} areas to watch`} />
        {DEBTORS.length > 0 && <Kpi label="Owed to you" value={loading ? '…' : fmt(totalAR)} note={`${DEBTORS.length} customers`} />}
      </section>

      <div className="glass" style={{ padding: '20px 20px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 className="ttl">Revenue vs expenses</h2>
            <div style={{ fontSize: 13, color: C.label, marginTop: 4 }}>Monthly from your bank statements · click a month for its figures</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Legend items={[{ label: 'Revenue', color: CHART.s1 }, { label: 'Expenses', color: CHART.s2 }, { label: 'Net profit', color: CHART.s3 }]} />
            <div role="group" aria-label="Period" style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button style={seg(range === 12)} aria-pressed={range === 12} onClick={() => setRange(12)}>12 months</button>
              <button style={seg(range === 6)} aria-pressed={range === 6} onClick={() => setRange(6)}>6 months</button>
            </div>
          </div>
        </div>

        {selected ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'center', margin: '14px 0 6px', padding: '12px 14px', borderRadius: 12, background: 'rgba(193,176,129,0.07)', border: '1px solid rgba(193,176,129,0.30)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.soft }}>Month
              <select value={selected.key} onChange={(e) => setSelKey(e.target.value)}
                style={{ minHeight: 36, padding: '0 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(0,0,0,0.4)', color: C.text, fontSize: 13 }}>
                {selectable.map((m) => <option key={m.key} value={m.key}>{monthName(m)}</option>)}
              </select>
            </label>
            <span className="tag" style={{ color: C.gold }}>{monthName(selected)}</span>
            <span style={{ fontSize: 13, color: C.soft }}>Revenue <span className="num">{fmt(selected.rev)}</span> · Expenses <span className="num">{fmt(selected.exp)}</span></span>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
              Net profit <span className="num">{fmt(selected.net)}</span>{selected.rev ? ` (${((selected.net / selected.rev) * 100).toFixed(1)}% margin)` : ''}
            </span>
          </div>
        ) : (
          <div style={{ margin: '14px 0 6px', fontSize: 13, color: C.label }}>No months with data yet — upload a bank statement in Documents.</div>
        )}

        <HBarChart rows={monthRows} yTitle="Month" xTitle="Revenue & expenses (R)" side={{ title: 'Net profit', color: CHART.s3 }}
          selectedKey={selected?.key} onSelect={setSelKey}
          ariaLabel="Horizontal bar chart. Months run down the vertical axis; revenue and expenses in rand run across with the figure at the end of each bar. Net profit per month is in its own column." />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        <div className="glass" style={{ padding: 20 }}>
          <h2 className="ttl">Cash forecast — next {WEEKLY_FORECAST.length || 8} weeks</h2>
          <div style={{ fontSize: 13, color: C.label, marginTop: 4 }}>Projected balance · dashed line = one week of your average spending</div>
          {weekRows.length ? (
            <>
              <div style={{ marginTop: 12 }}>
                <HBarChart rows={weekRows} yTitle="Week" xTitle="Projected balance (R)" formatValue={fmtK}
                  threshold={buffer > 0 ? { value: buffer, label: `Safety buffer ${fmtK(buffer)}`, color: C.watch } : undefined}
                  ariaLabel="Horizontal bar chart. Weeks run down the vertical axis; projected cash balance in rand runs across." />
              </div>
              {lowestWeek != null && buffer > 0 && WEEKLY_FORECAST[lowestWeek].balance < buffer && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(226,182,90,0.08)', border: '1px solid rgba(226,182,90,0.35)', fontSize: 13, color: C.text }}>
                  <span className="tag nowrap" style={{ color: C.watch, letterSpacing: '.1em' }}>Watch</span>
                  <span>Week {lowestWeek + 1} ({WEEKLY_FORECAST[lowestWeek].wk}) dips to <span className="num nowrap" style={{ color: '#F7E7C2' }}>{fmt(WEEKLY_FORECAST[lowestWeek].balance)}</span>, below your safety buffer.</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 16, fontSize: 13, color: C.soft, lineHeight: 1.6 }}>Upload two or more months of bank statements and Zeeder projects your weekly cash for the next 8 weeks.</div>
          )}
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <h2 className="ttl">Where the money goes</h2>
          <div style={{ fontSize: 13, color: C.label, marginTop: 4 }}>{monthName(latest)} expenses · <span className="num nowrap">{fmt(expTotal)}</span></div>
          {segments.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 22, marginTop: 14 }}>
              <Donut segments={segments} centre={latest.rev ? `${Math.round((expTotal / latest.rev) * 100)}%` : '—'} centreSub="of revenue" />
              <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {segments.map((s) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#D2E2EC' }}>{s.name}</span>
                    <span className="num nowrap" style={{ color: C.bright }}>{fmt(s.value)}</span>
                    <span className="num" style={{ width: 40, textAlign: 'right', color: C.label }}>{Math.round((s.value / expTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, fontSize: 13, color: C.soft }}>No expenses yet — they appear after your first bank statement.</div>
          )}
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <h2 className="ttl">Bills coming up</h2>
          <div style={{ fontSize: 13, color: C.label, marginTop: 4 }}>From your creditors list</div>
          {bills.length ? bills.map((b, i) => {
            const d = new Date(b.due)
            const valid = !Number.isNaN(d.getTime())
            return (
              <div key={`${b.name || b.supplier}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 2px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: i ? 0 : 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: b.overdue ? 'rgba(226,182,90,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${b.overdue ? 'rgba(226,182,90,0.5)' : 'rgba(255,255,255,0.08)'}`, color: b.overdue ? C.watch : C.soft }}>
                  <span style={{ fontSize: 10, letterSpacing: 1 }}>{valid ? d.toLocaleString('en-ZA', { month: 'short' }).toUpperCase() : ''}</span>
                  <span className="num" style={{ fontSize: 17, fontWeight: 600 }}>{valid ? d.getDate() : '—'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: C.text }}>{b.name || b.supplier}</div>
                  <div style={{ fontSize: 12, marginTop: 2, color: b.overdue ? C.watch : C.label }}>{b.overdue ? 'Overdue' : b.daysLeft != null ? `Due in ${b.daysLeft} days` : 'Upcoming'}</div>
                </div>
                <div className="num nowrap" style={{ fontSize: 15, color: C.bright }}>{fmt(b.amount)}</div>
              </div>
            )
          }) : <div style={{ marginTop: 16, fontSize: 13, color: C.soft }}>No bills yet — add creditors or upload supplier invoices.</div>}
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <h2 className="ttl">Zeeder's briefing</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {highFlags.map((f) => (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 12, background: 'rgba(226,182,90,0.08)', border: '1px solid rgba(226,182,90,0.3)' }}>
                <span className="num" style={{ fontSize: 10.5, letterSpacing: 1, padding: '3px 7px', borderRadius: 6, color: C.watch, background: 'rgba(226,182,90,0.12)', flexShrink: 0 }}>HIGH</span>
                <span style={{ fontSize: 13.5, color: C.text, lineHeight: 1.45 }}><strong>{f.title}.</strong> {f.action}</span>
              </div>
            ))}
            {BRIEFING.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 12, background: 'rgba(32,229,246,0.05)', border: '1px solid rgba(32,229,246,0.18)' }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, marginTop: 7, borderRadius: '50%', background: b.severity === 'high' ? C.watch : C.frank, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: C.text, lineHeight: 1.45 }}>{b.text}</span>
              </div>
            ))}
          </div>
          <button className="btn-ghost" style={{ marginTop: 14, width: '100%', color: C.frank, borderColor: 'rgba(32,229,246,0.35)' }}
            onClick={() => onAsk('What are the most important things I need to do today to keep my business healthy?')}>
            Ask Zeeder what to do today
          </button>
        </div>
      </section>
    </div>
  )
}
