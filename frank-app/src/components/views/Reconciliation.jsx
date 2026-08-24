import { useState } from 'react'
import { C, fmt } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'

function Section({ title, subtitle, children, accent }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.card }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: accent ? `${accent}08` : 'transparent' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

function TxRow({ tx, type, onRename, onAsk }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(tx.entityName)
  const color = type === 'credit' ? C.frank : C.warn
  const isMatched = !!tx.matchedName || tx.confirmed

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr 120px 90px 110px',
      gap: 10, alignItems: 'center',
      padding: '10px 14px',
      borderBottom: `1px solid ${C.border}`,
      background: isMatched ? `${color}04` : 'transparent',
    }}>
      <div style={{ fontSize: 10, color: C.dim, fontFamily: 'var(--mono)' }}>{tx.date}</div>

      <div>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onRename(tx.id, draft); setEditing(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(tx.id, draft); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
            style={{
              background: '#0a1828', border: `1px solid ${C.frank}`,
              color: C.text, borderRadius: 3, padding: '3px 7px',
              fontSize: 12, outline: 'none', width: '100%',
            }}
          />
        ) : (
          <div>
            <div
              onClick={() => setEditing(true)}
              title="Click to edit name"
              style={{ fontSize: 12, fontWeight: 600, color: isMatched ? color : C.text, cursor: 'text' }}>
              {tx.entityName}
            </div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tx.description}
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--mono)', textAlign: 'right' }}>
        {fmt(tx.amount)}
      </div>

      <div>
        {isMatched
          ? <span style={{ fontSize: 9, letterSpacing: 1, padding: '2px 7px', borderRadius: 3, background: `${color}15`, color, border: `1px solid ${color}30`, fontWeight: 700 }}>MATCHED</span>
          : <span style={{ fontSize: 9, letterSpacing: 1, padding: '2px 7px', borderRadius: 3, background: `${C.warn}15`, color: C.warn, border: `1px solid ${C.warn}30`, fontWeight: 700 }}>REVIEW</span>
        }
      </div>

      <button
        onClick={() => setEditing(true)}
        style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, fontSize: 10, cursor: 'pointer' }}>
        Rename
      </button>
    </div>
  )
}

export function Reconciliation({ onAsk, onNav }) {
  const { bankData, loadBankStatement, updateEntityName, confirmBankReconciliation, clearBankData } = useTenant()
  const [tab, setTab] = useState('all')

  if (!bankData) {
    return (
      <div className="fade-up" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Reconciliation</div>
          <div style={{ fontSize: 13, color: C.sub }}>Match your bank transactions to customers and suppliers.</div>
        </div>
        <div style={{ padding: '60px 24px', textAlign: 'center', background: '#0a1828' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏦</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>No bank statement loaded yet</div>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Upload a bank statement CSV or PDF in Documents, then click "Load into Reconciliation" to match transactions to your customers and suppliers.
          </div>
          <button
            onClick={() => onNav('documents')}
            style={{ padding: '12px 24px', borderRadius: 6, border: `1px solid ${C.frank}40`, background: C.frankMid, color: C.frank, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
            Go to Documents →
          </button>
        </div>
      </div>
    )
  }

  const { bankName, periodStart, periodEnd, closingBalance, credits, debits, isConfirmed } = bankData

  const unmatchedCredits  = credits.filter(t => !t.matchedName && !t.confirmed)
  const unmatchedDebits   = debits.filter(t => !t.matchedName && !t.confirmed)
  const unmatchedCount    = unmatchedCredits.length + unmatchedDebits.length
  const totalIn           = credits.reduce((s, t) => s + t.amount, 0)
  const totalOut          = debits.reduce((s, t) => s + t.amount, 0)

  const visibleCredits = tab === 'unmatched' ? unmatchedCredits : credits
  const visibleDebits  = tab === 'unmatched' ? unmatchedDebits  : debits

  return (
    <div className="fade-up" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Reconciliation</div>
            <div style={{ fontSize: 13, color: C.sub }}>
              {bankName} · {periodStart} to {periodEnd} · Closing balance: <strong style={{ color: C.frank }}>{fmt(closingBalance)}</strong>
            </div>
          </div>
          <button
            onClick={clearBankData}
            style={{ padding: '6px 12px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, fontSize: 11, cursor: 'pointer' }}>
            Clear ×
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: '#0a1828' }}>

        {/* ── Summary Stats ──────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Transactions', value: credits.length + debits.length, color: C.text },
            { label: 'Money In',     value: fmt(totalIn),  color: C.frank },
            { label: 'Money Out',    value: fmt(totalOut), color: C.warn },
            { label: 'Need Review',  value: unmatchedCount, color: unmatchedCount > 0 ? C.warn : C.frank },
          ].map(s => (
            <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--mono)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Confirmed Banner ───────────────────────── */}
        {isConfirmed && (
          <div style={{ padding: '14px 18px', background: `${C.frank}10`, border: `1px solid ${C.frank}30`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.frank }}>Reconciliation confirmed</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Debtors and Creditors views have been updated with this bank statement data.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => onNav('ar')} style={{ padding: '8px 14px', borderRadius: 4, border: `1px solid ${C.frank}30`, background: C.frankMid, color: C.frank, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>View Debtors</button>
              <button onClick={() => onNav('ap')} style={{ padding: '8px 14px', borderRadius: 4, border: `1px solid ${C.warn}30`, background: `${C.warn}10`, color: C.warn, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>View Creditors</button>
            </div>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────── */}
        <Section title="Transaction Review" subtitle={`${unmatchedCount > 0 ? `${unmatchedCount} transactions need a name — click to rename` : 'All transactions matched'} · Click any name to edit it`}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[
              ['all',      `All (${credits.length + debits.length})`],
              ['unmatched', `Need Review (${unmatchedCount})`],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: '5px 12px', borderRadius: 4,
                border: `1px solid ${tab === id ? C.frank : C.border}`,
                background: tab === id ? C.frankDim : 'transparent',
                color: tab === id ? C.frank : C.sub,
                fontSize: 12, cursor: 'pointer', fontWeight: tab === id ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 90px 110px', gap: 10, padding: '6px 14px', marginBottom: 4 }}>
            {['Date', 'Customer / Supplier', 'Amount', 'Status', ''].map(h => (
              <div key={h} style={{ fontSize: 9, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {/* Credits (money in) */}
          {visibleCredits.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ padding: '6px 14px', background: `${C.frank}10`, borderRadius: '4px 4px 0 0', borderTop: `2px solid ${C.frank}`, border: `1px solid ${C.frank}20` }}>
                <span style={{ fontSize: 10, color: C.frank, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Money Coming In — {visibleCredits.length} payments</span>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
                {visibleCredits.map(tx => (
                  <TxRow key={tx.id} tx={tx} type="credit" onRename={(id, name) => updateEntityName('credit', id, name)} onAsk={onAsk} />
                ))}
              </div>
            </div>
          )}

          {/* Debits (money out) */}
          {visibleDebits.length > 0 && (
            <div>
              <div style={{ padding: '6px 14px', background: `${C.warn}10`, borderRadius: '4px 4px 0 0', borderTop: `2px solid ${C.warn}`, border: `1px solid ${C.warn}20` }}>
                <span style={{ fontSize: 10, color: C.warn, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Money Going Out — {visibleDebits.length} payments</span>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
                {visibleDebits.map(tx => (
                  <TxRow key={tx.id} tx={tx} type="debit" onRename={(id, name) => updateEntityName('debit', id, name)} onAsk={onAsk} />
                ))}
              </div>
            </div>
          )}

          {visibleCredits.length === 0 && visibleDebits.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', color: C.frank, fontSize: 13 }}>
              All transactions matched
            </div>
          )}
        </Section>

        {/* ── Confirm CTA ────────────────────────────── */}
        {!isConfirmed && (
          <div style={{ padding: '18px 20px', background: C.card, border: `1px solid ${C.frank}30`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Ready to confirm?</div>
              <div style={{ fontSize: 12, color: C.sub }}>
                This will update your Debtors and Creditors views with data from this bank statement.
                {unmatchedCount > 0 && <span style={{ color: C.warn }}> {unmatchedCount} unmatched items will still be included — rename them first if needed.</span>}
              </div>
            </div>
            <button
              onClick={confirmBankReconciliation}
              style={{
                padding: '12px 24px', borderRadius: 6,
                border: `1px solid ${C.frank}40`, background: C.frankMid,
                color: C.frank, fontSize: 13, cursor: 'pointer', fontWeight: 700,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              Confirm & Update Debtors/Creditors →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
