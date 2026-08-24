import { useState } from 'react'
import { C, fmt } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'
import { SpreadsheetImporter } from '../SpreadsheetImporter'

const riskColor = (days) =>
  days > 90 ? C.danger : days > 30 ? C.warn : C.frank

const riskLabel = (days) =>
  days > 90 ? 'HIGH' : days > 30 ? 'MED' : 'LOW'

function DebtorRow({ learner, onAsk }) {
  const days  = learner.days_overdue ?? learner.daysOverdue ?? 0
  const color = riskColor(days)
  const name  = learner.name ?? learner.child_name ?? '—'
  const ref   = learner.reference ?? learner.ref ?? '—'
  const amt   = learner.amount ?? learner.outstanding ?? 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 90px 80px 70px 80px',
      gap: 12, alignItems: 'center',
      padding: '11px 16px',
      borderBottom: `1px solid ${C.border}`,
      fontSize: 13,
    }}>
      <div style={{ color: C.text, fontWeight: 600 }}>{name}</div>
      <div style={{ color: C.sub, fontFamily: 'var(--mono)', fontSize: 12 }}>{ref}</div>
      <div style={{ color, fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(amt)}</div>
      <div style={{
        color, fontWeight: 700, fontSize: 11, letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        {riskLabel(days)}
      </div>
      <button onClick={() => onAsk(`What should we do about ${name}'s outstanding balance of ${fmt(amt)}?`)}
        style={{
          padding: '5px 10px', borderRadius: 3,
          border: `1px solid ${color}30`, background: `${color}10`,
          color, fontSize: 11, cursor: 'pointer',
          fontWeight: 700, letterSpacing: 0.8,
        }}>
        Ask Zeeder
      </button>
    </div>
  )
}

export function Debtors({ onAsk, liveData, loading, error, onNav }) {
  const { bankData, data, importDebtors, clearImportedDebtors, clearBankData, importedData, activeTenantId } = useTenant()
  const [showImporter, setShowImporter] = useState(false)
  const bankConfirmed = bankData?.isConfirmed && bankData?.confirmedDebtors?.length > 0
  const importedDebtors = importedData?.[activeTenantId]?.DEBTORS

  // Priority: bank statement → live API → imported spreadsheet → static tenant data
  let rows, dataSource
  if (bankConfirmed) {
    rows = bankData.confirmedDebtors
    dataSource = 'bank'
  } else if (liveData?.outstanding) {
    const rawOut = liveData.outstanding
    rows = Array.isArray(rawOut) ? rawOut : Object.values(rawOut)
    dataSource = 'live'
  } else if (importedDebtors) {
    rows = importedDebtors
    dataSource = 'imported'
  } else {
    rows = data.DEBTORS || []
    dataSource = 'static'
  }
  const total = rows.reduce((s, r) => s + (r.amount ?? r.outstanding ?? 0), 0)

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Bank source banner */}
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

      {/* Imported spreadsheet banner */}
      {dataSource === 'imported' && (
        <div style={{ padding: '10px 16px', background: `${C.gold}08`, border: `1px solid ${C.gold}30`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: C.gold }}>
            Showing <strong>{rows.length} row{rows.length !== 1 ? 's' : ''}</strong> imported from spreadsheet
          </div>
          <button onClick={() => { clearImportedDebtors(); setShowImporter(false) }} style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${C.gold}30`, background: 'transparent', color: C.gold, fontSize: 11, cursor: 'pointer' }}>
            Clear &amp; Re-import
          </button>
        </div>
      )}

      {/* Header strip */}
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{
          flex: 1, background: C.card, border: `1px solid ${C.border}`,
          borderTop: `2px solid ${C.warn}`, borderRadius: 6, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Total Outstanding
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.warn, fontFamily: 'var(--mono)' }}>
            {loading ? '…' : fmt(total)}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>
            {loading ? 'Loading…' : `${rows.length} learner${rows.length !== 1 ? 's' : ''} with outstanding fees`}
          </div>
        </div>

        <div style={{
          flex: 1, background: C.card, border: `1px solid ${C.border}`,
          borderTop: `2px solid ${C.danger}`, borderRadius: 6, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            High Risk (&gt;90 days)
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.danger, fontFamily: 'var(--mono)' }}>
            {loading ? '…' : fmt(rows.filter(r => (r.days_overdue ?? r.daysOverdue ?? 0) > 90).reduce((s, r) => s + (r.amount ?? r.outstanding ?? 0), 0))}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>
            {loading ? '' : `${rows.filter(r => (r.days_overdue ?? r.daysOverdue ?? 0) > 90).length} families — write-off risk`}
          </div>
        </div>

        <div style={{
          flex: 1, background: C.card, border: `1px solid ${C.border}`,
          borderTop: `2px solid ${C.frank}`, borderRadius: 6, padding: '16px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10,
        }}>
          <button onClick={() => onAsk(`Give me a collection action plan for all ${rows.length} outstanding debtors totalling ${fmt(total)}`)}
            style={{
              padding: '10px 16px', borderRadius: 4, border: `1px solid ${C.frank}30`,
              background: C.frankDim, color: C.frank, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            }}>
            ⚡ Collection Action Plan
          </button>
          <button onClick={() => setShowImporter(true)}
            style={{
              padding: '10px 16px', borderRadius: 4, border: `1px solid ${C.gold}30`,
              background: `${C.gold}08`, color: C.gold, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            }}>
            ↑ Import from Spreadsheet
          </button>
        </div>
      </div>

      {showImporter && (
        <SpreadsheetImporter
          type="debtors"
          onImport={rows => { importDebtors(rows); setShowImporter(false) }}
          onClose={() => setShowImporter(false)}
        />
      )}

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 80px 70px 80px',
          gap: 12, padding: '10px 16px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: 'uppercase',
        }}>
          <div>Learner / Family</div>
          <div>Reference</div>
          <div>Amount</div>
          <div>Risk</div>
          <div />
        </div>

        {loading && (
          <div style={{ padding: 24, color: C.sub, fontSize: 13 }}>Loading outstanding balances…</div>
        )}

        {error && (
          <div style={{ padding: 24, color: C.danger, fontSize: 13 }}>
            Could not load data: {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: 24, color: C.frank, fontSize: 13 }}>
            No outstanding balances this month.
          </div>
        )}

        {!loading && rows
          .sort((a, b) => (b.amount ?? b.outstanding ?? 0) - (a.amount ?? a.outstanding ?? 0))
          .map((r, i) => (
            <DebtorRow key={r.reference ?? r.ref ?? i} learner={r} onAsk={onAsk} />
          ))}
      </div>
    </div>
  )
}
