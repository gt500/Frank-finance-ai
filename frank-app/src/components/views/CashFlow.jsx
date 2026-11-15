import { C, CHART, fmt, fmtK } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'
import { HBarChart, Legend } from '../charts/HBarChart'
import { safetyBuffer } from '../../lib/monthlyHistory'

const hasData = (m) => (m.rev || 0) > 0 || (m.exp || 0) > 0

export function CashFlow({ onAsk }) {
  const { data } = useTenant()
  const { MONTHLY = [], WEEKLY_FORECAST = [], CASHFLOW_FLAGS = [], DEBTORS = [], CREDITORS = [] } = data

  const withData = MONTHLY.filter(hasData)
  const currentCash = (withData[withData.length - 1] || MONTHLY[MONTHLY.length - 1] || { cash: 0 }).cash
  const buffer = safetyBuffer(MONTHLY)
  const belowBuffer = buffer > 0 && currentCash < buffer
  const totalAR = DEBTORS.reduce((s, d) => s + (d.amount || 0), 0)
  const nextBill = [...CREDITORS].sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))[0]   // copy: never reorder shared data
  const highFlag = CASHFLOW_FLAGS.find((f) => f.severity === 'HIGH' && f.impact < 0)

  const ioRows = WEEKLY_FORECAST.map((w, i) => ({
    key: `${w.wk}-${i}`, label: `Week ${i + 1}`, sub: w.wk,
    bars: [
      { value: w.inflow, color: CHART.s1, text: fmtK(w.inflow), tip: `Week ${i + 1} (${w.wk}): money in ${fmt(w.inflow)}` },
      { value: w.outflow, color: CHART.s2, text: `${fmtK(w.outflow)}${w.salary ? ' · payday' : ''}`, tip: `Week ${i + 1} (${w.wk}): money out ${fmt(w.outflow)}${w.salary ? ' (salaries)' : ''}` },
    ],
  }))
  const balRows = WEEKLY_FORECAST.map((w, i) => {
    const low = buffer > 0 && w.balance < buffer
    return {
      key: `${w.wk}-${i}`, label: `Week ${i + 1}`, sub: w.wk,
      bars: [{ value: w.balance, color: low ? 'rgba(11,157,179,0.30)' : CHART.s1, stroke: low ? C.watch : undefined, bold: low,
        text: low ? `${fmtK(w.balance)} · below buffer` : fmtK(w.balance), textColor: low ? '#F7E7C2' : undefined,
        tip: `Week ${i + 1} (${w.wk}): balance ${fmt(w.balance)}${low ? ' — below safety buffer' : ''}` }],
    }
  })

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="glass" style={{ padding: '18px 20px', gridColumn: 'span 2' }}>
          <div style={{ fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', color: C.label }}>Cash in the bank</div>
          <div className="num nowrap" style={{ fontSize: 38, fontWeight: 600, color: C.bright, marginTop: 8, letterSpacing: '-1px' }}>{fmt(currentCash)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: C.text }}>
            {buffer > 0 && (
              <span className="tag nowrap" style={{ color: belowBuffer ? C.watch : C.frank, letterSpacing: '.1em' }}>{belowBuffer ? 'Watch' : 'Healthy'}</span>
            )}
            <span>{buffer > 0 ? `Your safety buffer is ${fmt(buffer)} — one week of average spending.` : 'Upload a bank statement to see your cash position.'}</span>
          </div>
          {highFlag && <div style={{ fontSize: 12.5, color: C.soft, marginTop: 8, lineHeight: 1.6 }}>{highFlag.detail}</div>}
        </div>
        {DEBTORS.length > 0 && (
          <div className="glass" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', color: C.label }}>Owed to you</div>
            <div className="num nowrap" style={{ fontSize: 26, fontWeight: 600, color: C.bright, marginTop: 8 }}>{fmt(totalAR)}</div>
            <div style={{ fontSize: 12, color: C.label, marginTop: 4 }}>{DEBTORS.length} {DEBTORS.length === 1 ? 'customer has' : 'customers have'} not paid</div>
          </div>
        )}
        {nextBill && (
          <div className="glass" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', color: nextBill.overdue ? C.watch : C.label }}>{nextBill.overdue ? 'Bill overdue' : 'Next bill due'}</div>
            <div className="num nowrap" style={{ fontSize: 26, fontWeight: 600, color: C.bright, marginTop: 8 }}>{fmt(nextBill.amount)}</div>
            <div style={{ fontSize: 12, color: C.label, marginTop: 4 }}>{nextBill.name || nextBill.supplier} · due {nextBill.due}</div>
          </div>
        )}
      </section>

      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <h2 className="ttl">Money in vs money out — weekly</h2>
            <div style={{ fontSize: 13, color: C.label, marginTop: 4 }}>Projected from your recurring bank transactions · hover a bar for the exact figure</div>
          </div>
          <Legend items={[{ label: 'Money in', color: CHART.s1 }, { label: 'Money out', color: CHART.s2 }]} />
        </div>
        {ioRows.length ? (
          <div style={{ marginTop: 12 }}>
            <HBarChart rows={ioRows} yTitle="Week" xTitle="Rand" formatValue={fmtK}
              ariaLabel="Horizontal grouped bar chart. Weeks run down the vertical axis; money in and money out in rand run across." />
          </div>
        ) : <div style={{ marginTop: 16, fontSize: 13, color: C.soft }}>Upload two or more months of bank statements to see your weekly forecast.</div>}
      </div>

      {balRows.length > 0 && (
        <div className="glass" style={{ padding: 20 }}>
          <h2 className="ttl">Projected balance</h2>
          <div style={{ fontSize: 13, color: C.label, marginTop: 4 }}>Week by week · dashed line is your safety buffer</div>
          <div style={{ marginTop: 12 }}>
            <HBarChart rows={balRows} yTitle="Week" xTitle="Balance (R)" formatValue={fmtK}
              threshold={buffer > 0 ? { value: buffer, label: `Safety buffer ${fmtK(buffer)}`, color: C.watch } : undefined}
              ariaLabel="Horizontal bar chart. Weeks run down the vertical axis; projected cash balance in rand runs across." />
          </div>
        </div>
      )}

      <div className="glass" style={{ padding: 20 }}>
        <h2 className="ttl">Upcoming cash events</h2>
        <div style={{ fontSize: 13, color: C.label, marginTop: 4 }}>What will move your balance in the coming weeks — and what to do about it</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {CASHFLOW_FLAGS.length ? CASHFLOW_FLAGS.map((flag) => {
            const tone = flag.severity === 'HIGH' ? C.watch : C.frank
            return (
              <div key={flag.id} style={{ padding: '14px 16px', borderRadius: 12, background: `${tone}0d`, border: `1px solid ${tone}38`, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className="num" style={{ fontSize: 10.5, letterSpacing: 1, padding: '3px 7px', borderRadius: 6, color: tone, background: `${tone}1f` }}>{flag.severity}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{flag.title}</span>
                    {flag.nextDate && <span style={{ fontSize: 12, color: C.label }}>{flag.nextDate}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.soft, lineHeight: 1.6 }}>{flag.detail}</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginTop: 4 }}><strong>What to do:</strong> {flag.action}</div>
                </div>
                <button className="btn-ghost" style={{ color: C.frank, borderColor: 'rgba(32,229,246,0.35)' }} onClick={() => onAsk(`Help me understand and deal with: ${flag.title}`)}>Ask Zeeder</button>
              </div>
            )
          }) : <div style={{ fontSize: 13, color: C.soft }}>No cash events flagged yet.</div>}
        </div>
        <button className="btn-gold" style={{ marginTop: 16 }} onClick={() => onAsk('Help me plan my cash for next month — what do I need to do this week to avoid running short?')}>Help me plan cash</button>
      </div>
    </div>
  )
}
