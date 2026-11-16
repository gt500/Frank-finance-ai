import { useCallback, useEffect, useState } from 'react'
import { C } from '../../lib/theme'
import * as ledger from '../../lib/ledgerApi'
import { getSettings, todaySA } from '../../lib/invoiceApi'
import { PERIOD_KINDS, periodRange } from '../../lib/periods'
import { buildStatements } from '../../lib/statements'
import { money, statementViews } from '../../lib/statementRows'
import { Card, Empty } from '../shared'
import { Field, Notice, inputStyle } from '../invoices/fields'
import { RecordTransaction } from '../statements/RecordTransaction'
import { usePlanAccess } from '../PlanGate'
import { StatementSheet } from '../statements/StatementSheet'
import { Adjustments } from '../statements/Adjustments'

const TABS = [['income', 'Income statement'], ['balance', 'Financial position'], ['cashFlow', 'Cash flows'], ['equity', 'Changes in equity'], ['trial', 'Trial balance']]

export function FinancialStatements() {
  const { can } = usePlanAccess()
  const tabs = TABS.filter(([id]) => id === 'income' || can('fullStatements'))
  const today = todaySA()
  const [kind, setKind] = useState('month')
  const [custom, setCustom] = useState({ from: today.slice(0, 8) + '01', to: today })
  const [tab, setTab] = useState('income')
  const [accounts, setAccounts] = useState([])
  const [business, setBusiness] = useState('')
  const [data, setData] = useState(null)
  const [recorded, setRecorded] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [postError, setPostError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  let range = null, rangeError = ''
  try { range = periodRange(kind, today, custom) } catch (e) { rangeError = e.message }

  useEffect(() => {
    let live = true
    Promise.all([ledger.getChartAccounts(), getSettings()]).then(([a, s]) => { if (live) { setAccounts(a); setBusiness(s?.business_name ?? '') } })
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [])

  const from = range?.from, to = range?.to, priorFrom = range?.priorFrom, priorTo = range?.priorTo
  const periodLabel = range?.label, priorLabel = range?.priorLabel
  useEffect(() => {
    if (!from) return undefined
    let live = true
    // Depreciation for the months that have ended is posted first, so the numbers below always include it.
    ledger.postDepreciation(today)
      .then(() => Promise.all([ledger.getLedgerTotals(from, to), ledger.getLedgerTotals(priorFrom, priorTo), ledger.listRecordedEntries(), ledger.getTaxRate(), ledger.countPostedBankLines()]))
      .then(([current, prior, entries, taxRatePercent, bankLinesPosted]) => {
        if (live) { setData({ current, prior, from, to, priorFrom, priorTo, periodLabel, priorLabel, taxRatePercent, bankLinesPosted }); setRecorded(entries); setError('') }
      })
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [from, to, priorFrom, priorTo, periodLabel, priorLabel, reloadKey, today])

  const post = useCallback(async (entry) => {
    setBusy(true); setPostError(''); setNotice(null)
    try { await ledger.postEntry(entry); setRecording(false); setNotice({ kind: 'ok', text: 'Recorded.' }); setReloadKey((k) => k + 1) }
    catch (e) { setPostError(e.message) } finally { setBusy(false) }
  }, [])
  const reverse = async (id) => {
    setBusy(true); setNotice(null)
    try { await ledger.reverseEntry(id); setNotice({ kind: 'ok', text: 'Reversed. The original stays on record.' }); setReloadKey((k) => k + 1) }
    catch (e) { setNotice({ kind: 'error', text: e.message }) } finally { setBusy(false) }
  }

  if (error) return <Notice kind="error">Couldn&apos;t load your statements: {error}</Notice>

  // Only ever show numbers for the period that is selected right now (never stale ones under a new or invalid period).
  const fresh = data && range && data.from === from && data.to === to ? data : null
  const statements = fresh && accounts.length ? buildStatements({ accounts, current: fresh.current, prior: fresh.prior, from: fresh.from, to: fresh.to, priorFrom: fresh.priorFrom, priorTo: fresh.priorTo, taxRatePercent: fresh.taxRatePercent, bankLinesPosted: fresh.bankLinesPosted }) : null
  const views = statements ? statementViews(statements, { periodLabel: fresh.periodLabel, priorLabel: fresh.priorLabel }) : null
  const empty = fresh && fresh.current.length === 0 && fresh.prior.length === 0
  const broken = statements && !(statements.balance.balanced && statements.trialBalance.balanced && statements.cashFlow.reconciles)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Period" style={{ minWidth: 190 }}>
            <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)}>{PERIOD_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
          </Field>
          {kind === 'custom' && <>
            <Field label="From"><input style={inputStyle} type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
            <Field label="To"><input style={inputStyle} type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
          </>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-ghost" onClick={() => window.print()} disabled={!views}>Print or save as PDF</button>
          {can('recording') && <button type="button" className="btn-gold" onClick={() => { setRecording(!recording); setPostError('') }}>{recording ? 'Close' : 'Record a transaction'}</button>}
        </div>
      </div>
      {rangeError && <Notice kind="error">{rangeError}</Notice>}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {recording && <Card title="Record a transaction" sub="Invoices and payments are recorded for you. Use this for everything else, such as expenses and the money you started with."><RecordTransaction accounts={accounts} busy={busy} error={postError} onPost={post} onCancel={() => setRecording(false)} /></Card>}

      {!statements && !rangeError && <Empty message="Loading…" />}
      {empty && !recording && (
        <Card title="Nothing recorded for these dates yet">
          <p style={{ margin: '0 0 12px', color: C.soft, fontSize: 14 }}>Statements are built from your books. Issue an invoice, or record your opening bank balance and your expenses, and they appear here.</p>
          <button type="button" className="btn-gold" onClick={() => setRecording(true)}>Record a transaction</button>
        </Card>
      )}
      {broken && <Notice kind="error">These statements do not balance. Please do not rely on them and contact support.</Notice>}

      {views && !empty && <>
        <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'btn-gold' : 'btn-ghost'} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        <StatementSheet business={business} view={views[tab]} />
        {tab === 'income' && <Movements statements={statements} />}
        <Card title="Notes"><ul style={{ margin: 0, paddingLeft: 18, color: C.soft, fontSize: 13, lineHeight: 1.7 }}>{statements.notes.map((n) => <li key={n}>{n}</li>)}</ul></Card>
      </>}

      {can('adjustments') && <Adjustments onChanged={() => setReloadKey((k) => k + 1)} />}

      <Recorded entries={recorded} busy={busy} onReverse={reverse} />
    </div>
  )
}

function Movements({ statements }) {
  const { flags, margins } = statements.income
  const pct = (n) => (n === null ? '–' : `${String(n).replace('.', ',')}%`)
  return (
    <Card title="Worth a look" sub="Compared with the previous period. Only movements over R 1 000 and 10% are listed.">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14, color: C.soft, marginBottom: flags.length ? 12 : 0 }}>
        <span>Gross margin: <strong className="num" style={{ color: C.text }}>{pct(margins.gross)}</strong></span>
        <span>Net margin: <strong className="num" style={{ color: C.text }}>{pct(margins.net)}</strong></span>
      </div>
      {flags.length === 0 ? <div style={{ fontSize: 14, color: C.soft }}>No big movements.</div> : flags.map((f) => (
        <div key={f.label} style={{ fontSize: 14, color: C.text, padding: '4px 0' }}>
          <strong>{f.label}</strong> {f.varianceCents > 0 ? 'up' : 'down'} {money(Math.abs(f.varianceCents))}{f.pct === null ? '' : ` (${f.pct > 0 ? '+' : ''}${String(f.pct).replace('.', ',')}%)`}
          <span style={{ color: f.direction === 'favourable' ? C.frank : C.watch }}> · {f.direction}</span>
        </div>
      ))}
    </Card>
  )
}

function Recorded({ entries, busy, onReverse }) {
  const [confirm, setConfirm] = useState(null)
  const reversed = new Set(entries.filter((e) => e.source_type === 'reversal').map((e) => e.reverses))
  const mine = entries.filter((e) => e.source_type === 'manual')
  if (mine.length === 0) return null
  return (
    <Card title="Transactions you recorded" sub="A mistake is never edited. Reverse it and record it again; both stay on record.">
      {mine.map((e) => {
        const cents = e.journal_lines.reduce((s, l) => s + Number(l.debit_cents), 0)
        const done = reversed.has(e.id)
        return (
          <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', opacity: done ? 0.55 : 1 }}>
            <span style={{ fontSize: 14, color: C.text }}>{e.entry_date} · {e.memo} · <span className="num">{money(cents)}</span></span>
            {done ? <span style={{ fontSize: 12, color: C.label }}>Reversed</span>
              : confirm === e.id
                ? <span style={{ display: 'flex', gap: 8 }}><button type="button" className="btn-gold" disabled={busy} onClick={async () => { await onReverse(e.id); setConfirm(null) }}>Yes, reverse it</button><button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>Keep it</button></span>
                : <button type="button" className="btn-ghost" onClick={() => setConfirm(e.id)}>Reverse</button>}
          </div>
        )
      })}
    </Card>
  )
}
