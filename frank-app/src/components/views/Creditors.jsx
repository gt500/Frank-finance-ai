import { useState } from 'react'
import { C, fmt } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'
import { SpreadsheetImporter } from '../SpreadsheetImporter'

function statusBadge(c) {
  if (c.overdue)        return { label: 'OVERDUE',       color: C.danger }
  if (c.daysLeft <= 7)  return { label: 'DUE THIS WEEK', color: C.danger }
  if (c.daysLeft <= 14) return { label: 'DUE SOON',      color: C.warn }
  return { label: 'OK', color: C.frank }
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

export function Creditors({ onAsk, onNav }) {
  const { data, bankData, importCreditors, clearImportedCreditors, clearBankData, importedData, activeTenantId } = useTenant()
  const [showImporter, setShowImporter] = useState(false)
  const bankConfirmed = bankData?.isConfirmed && bankData?.confirmedCreditors?.length > 0
  const importedCreditors = importedData?.[activeTenantId]?.CREDITORS
  const dataSource = bankConfirmed ? 'bank' : importedCreditors ? 'imported' : 'static'
  const CREDITORS = bankConfirmed ? bankData.confirmedCreditors : importedCreditors ?? data.CREDITORS

  const totalOwed    = CREDITORS.reduce((s, c) => s + c.amount, 0)
  const totalOverdue = CREDITORS.filter(c => c.overdue).reduce((s, c) => s + c.amount, 0)
  const dueSoon      = CREDITORS.filter(c => !c.overdue && c.daysLeft <= 7).reduce((s, c) => s + c.amount, 0)

  const sortedByUrgency = [...CREDITORS].sort((a, b) => {
    if (a.overdue && !b.overdue) return -1
    if (!a.overdue && b.overdue) return 1
    return a.daysLeft - b.daysLeft
  })

  const urgencyColor = (rank) => rank === 0 ? C.danger : rank === 1 ? C.warn : C.frank

  return (
    <div className="fade-up" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Bills to Pay</div>
        <div style={{ fontSize: 13, color: C.sub }}>Everything you currently owe to suppliers — amounts, due dates, and which ones to pay first.</div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: '#0a1828' }}>

        {/* ── Bank source banner ───────────────────────────── */}
        {bankConfirmed && (
          <div style={{ padding: '10px 16px', background: `${C.frank}10`, border: `1px solid ${C.frank}25`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: C.frank }}>
              Showing data from bank statement: <strong>{bankData.bankName}</strong> · {bankData.periodStart} to {bankData.periodEnd}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onNav('reconcile')} style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${C.frank}30`, background: 'transparent', color: C.frank, fontSize: 11, cursor: 'pointer' }}>
                View Reconciliation
              </button>
              <button onClick={clearBankData} style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${C.danger}30`, background: 'transparent', color: C.danger, fontSize: 11, cursor: 'pointer' }}>
                ✕ Clear statement
              </button>
            </div>
          </div>
        )}

        {/* ── Imported spreadsheet banner ──────────────────── */}
        {dataSource === 'imported' && (
          <div style={{ padding: '10px 16px', background: `${C.gold}08`, border: `1px solid ${C.gold}30`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: C.gold }}>
              Showing <strong>{CREDITORS.length} row{CREDITORS.length !== 1 ? 's' : ''}</strong> imported from spreadsheet
            </div>
            <button onClick={() => clearImportedCreditors()} style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${C.gold}30`, background: 'transparent', color: C.gold, fontSize: 11, cursor: 'pointer' }}>
              Clear &amp; Re-import
            </button>
          </div>
        )}

        {/* ── Section 1: Summary Figures ───────────────────── */}
        <Section title="Summary — What You Owe" subtitle="A quick overview of all outstanding supplier bills">
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1, background: '#0a1828', border: `1px solid ${C.warn}30`, borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Total Owed to Suppliers</div>
              <div style={{ fontSize: 38, fontWeight: 800, color: C.warn, fontFamily: 'var(--mono)', lineHeight: 1 }}>{fmt(totalOwed)}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>{CREDITORS.length} supplier{CREDITORS.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ flex: 1, background: '#0a1828', border: `1px solid ${totalOverdue > 0 ? C.danger : C.border}30`, borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Overdue Right Now</div>
              <div style={{ fontSize: 38, fontWeight: 800, color: totalOverdue > 0 ? C.danger : C.frank, fontFamily: 'var(--mono)', lineHeight: 1 }}>
                {totalOverdue > 0 ? fmt(totalOverdue) : 'None'}
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>
                {totalOverdue > 0 ? 'Pay immediately to avoid supply disruption' : 'Nothing overdue — well done'}
              </div>
            </div>
            <div style={{ flex: 1, background: '#0a1828', border: `1px solid ${dueSoon > 0 ? C.danger : C.border}30`, borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Due This Week</div>
              <div style={{ fontSize: 38, fontWeight: 800, color: dueSoon > 0 ? C.danger : C.frank, fontFamily: 'var(--mono)', lineHeight: 1 }}>
                {dueSoon > 0 ? fmt(dueSoon) : 'None'}
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>
                {dueSoon > 0 ? `${CREDITORS.filter(c => !c.overdue && c.daysLeft <= 7).length} bill${CREDITORS.filter(c => !c.overdue && c.daysLeft <= 7).length !== 1 ? 's' : ''} due within 7 days` : 'Nothing due this week'}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Supplier Detail Table ─────────────── */}
        <Section title="Supplier Bills — Full Detail" subtitle="Each bill, what it's for, how much, and when you need to pay it">
          <div style={{
            display: 'grid', gridTemplateColumns: '1.6fr 100px 110px 110px 120px',
            padding: '8px 12px', marginBottom: 6,
          }}>
            {['Supplier', 'Amount', 'Due Date', 'Days Left', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            {CREDITORS.map((c, i) => {
              const badge    = statusBadge(c)
              const isUrgent = badge.label === 'OVERDUE' || badge.label === 'DUE THIS WEEK'
              return (
                <div
                  key={c.ref}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.6fr 100px 110px 110px 120px',
                    alignItems: 'center',
                    padding: '14px 12px',
                    borderBottom: i < CREDITORS.length - 1 ? `1px solid ${C.border}` : 'none',
                    background: isUrgent ? `${C.danger}06` : 'transparent',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: 'var(--mono)' }}>{fmt(c.amount)}</div>
                  <div style={{ fontSize: 12, color: C.sub }}>{c.due}</div>
                  <div style={{ fontSize: 12, color: badge.color, fontWeight: 600 }}>
                    {c.overdue ? 'Overdue!' : `${c.daysLeft} days`}
                  </div>
                  <div>
                    <span style={{
                      padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                      background: `${badge.color}15`, color: badge.color, border: `1px solid ${badge.color}30`,
                    }}>{badge.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Section 3: Payment Priority ───────────────────── */}
        <Section title="Which Bills to Pay First" subtitle="Ordered by urgency — overdue first, then due soonest">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedByUrgency.map((c, i) => {
              const color = urgencyColor(i)
              const badge = statusBadge(c)
              return (
                <div key={c.ref} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '12px 16px', borderRadius: 6,
                  border: `1px solid ${color}20`, background: `${color}06`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: `${color}20`,
                    border: `1px solid ${color}40`, color, fontSize: 13, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{fmt(c.amount)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: `${badge.color}15`, color: badge.color, border: `1px solid ${badge.color}30`, marginRight: 8 }}>{badge.label}</span>
                      {c.overdue ? 'Pay immediately — this is overdue.' : `Due in ${c.daysLeft} day${c.daysLeft !== 1 ? 's' : ''}.`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Section 4: Zeeder's Assessment ───────────────── */}
        <Section title="Zeeder's Assessment" subtitle="What this all means for your business" accent={C.frank}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.8, flex: 1 }}>
              {totalOverdue > 0 && (
                <>You have <strong style={{ color: C.danger }}>{fmt(totalOverdue)}</strong> in overdue bills — pay these immediately to avoid service disruption. </>
              )}
              {sortedByUrgency[0] && (
                <>Your most urgent upcoming bill is <strong style={{ color: C.warn }}>{sortedByUrgency[0].name}</strong> at {fmt(sortedByUrgency[0].amount)}{sortedByUrgency[0].daysLeft > 0 ? `, due in ${sortedByUrgency[0].daysLeft} days` : ' (overdue)'}. </>
              )}
              Total bills due: <strong style={{ color: C.warn }}>{fmt(totalOwed)}</strong>. Plan your cash collections to cover this before each due date.
            </div>
            <button
              onClick={() => onAsk('Which bills should I pay first and how do I manage my cash to cover all outstanding supplier payments?')}
              style={{ padding: '12px 20px', borderRadius: 6, border: `1px solid ${C.frank}40`, background: C.frankMid, color: C.frank, fontSize: 13, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Which bills first? →
            </button>
          </div>
        </Section>

      </div>

      {/* Import button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowImporter(true)} style={{
          padding: '10px 20px', borderRadius: 6,
          border: `1px solid ${C.gold}30`, background: `${C.gold}08`,
          color: C.gold, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
        }}>
          ↑ Import from Spreadsheet
        </button>
      </div>

      {showImporter && (
        <SpreadsheetImporter
          type="creditors"
          onImport={rows => { importCreditors(rows); setShowImporter(false) }}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  )
}
