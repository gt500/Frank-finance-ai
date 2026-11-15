import { useState } from 'react'
import { C } from '../../lib/theme'
import { toCents } from '../../lib/invoicing'
import { money } from '../../lib/statementRows'
import { cashSaleEntry, expenseEntry, openingBalanceEntry, ownerEntry, supplierPaymentEntry } from '../../lib/ledgerEntries'
import { todaySA } from '../../lib/invoiceApi'
import { Field, inputStyle } from '../invoices/fields'

const KINDS = [
  ['expense', 'Money I spent (an expense)'], ['supplierPayment', 'Paying a supplier I owe'], ['cashSale', 'A cash or card sale (no invoice)'],
  ['owner', 'Owner put money in or took money out'], ['opening', 'Opening bank balance'],
]

function build(kind, f) {
  const base = { date: f.date, description: f.description }
  const cents = toCents(f.amount)
  if (kind === 'expense') return expenseEntry({ ...base, supplier: f.supplier, account: f.account, totalCents: cents, vat: f.vat, paid: f.paid })
  if (kind === 'supplierPayment') return supplierPaymentEntry({ ...base, amountCents: cents })
  if (kind === 'cashSale') return cashSaleEntry({ ...base, totalCents: cents, vat: f.vat })
  if (kind === 'owner') return ownerEntry({ date: f.date, kind: f.ownerKind, amountCents: cents })
  return openingBalanceEntry({ date: f.date, bankCents: cents })
}

/** Guided entry: pick what happened, fill in the amount, see exactly what will be recorded, then record it. */
export function RecordTransaction({ accounts, busy, error, onPost, onCancel }) {
  const [kind, setKind] = useState('expense')
  const [f, setF] = useState({ date: todaySA(), description: '', supplier: '', account: '6900', amount: '', vat: true, paid: true, ownerKind: 'contribution' })
  const [problem, setProblem] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const nameOf = (code) => accounts.find((a) => a.code === code)?.name ?? code
  const categories = accounts.filter((a) => a.type === 'expense' || a.code === '1200' || a.code === '1500')

  let preview = null
  try { preview = build(kind, f) } catch { preview = null }
  const needsText = kind === 'expense' || kind === 'supplierPayment' || kind === 'cashSale'

  const submit = (e) => {
    e.preventDefault(); setProblem('')
    try { onPost(build(kind, f)) } catch (err) { setProblem(err.message) }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <Field label="What happened?">
        <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </Field>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <Field label="Date"><input style={inputStyle} type="date" value={f.date} onChange={set('date')} required /></Field>
        {needsText && <Field label={kind === 'cashSale' ? 'Description' : kind === 'supplierPayment' ? 'Supplier' : 'What was it for?'}><input style={inputStyle} value={f.description} onChange={set('description')} required /></Field>}
        {kind === 'expense' && <Field label="Supplier (optional)"><input style={inputStyle} value={f.supplier} onChange={set('supplier')} /></Field>}
        {kind === 'expense' && <Field label="Category"><select style={inputStyle} value={f.account} onChange={set('account')}>{categories.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</select></Field>}
        {kind === 'owner' && <Field label="Which way?"><select style={inputStyle} value={f.ownerKind} onChange={set('ownerKind')}><option value="contribution">Owner put money in</option><option value="drawing">Owner took money out</option></select></Field>}
        <Field label={kind === 'opening' ? 'Bank balance (R)' : 'Amount (R)'} hint={kind === 'expense' || kind === 'cashSale' ? 'The full amount, VAT included.' : undefined}>
          <input style={inputStyle} inputMode="decimal" placeholder="0.00" value={f.amount} onChange={set('amount')} required />
        </Field>
      </div>
      {(kind === 'expense' || kind === 'cashSale') && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: C.text }}><input type="checkbox" checked={f.vat} onChange={set('vat')} />This amount includes 15% VAT</label>
      )}
      {kind === 'expense' && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: C.text }}><input type="checkbox" checked={f.paid} onChange={set('paid')} />Already paid (untick if you still owe the supplier)</label>
      )}

      {preview && (
        <div className="glass" style={{ padding: 14 }} aria-label="What will be recorded">
          <div className="ttl" style={{ marginBottom: 8 }}>This will be recorded</div>
          {preview.lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, color: C.soft, padding: '2px 0' }}>
              <span>{l.debit ? 'Debit' : 'Credit'} · {nameOf(l.account)}</span><span className="num">{money(l.debit || l.credit)}</span>
            </div>
          ))}
        </div>
      )}
      {(problem || error) && <div role="alert" style={{ color: C.danger, fontSize: 14 }}>{problem || error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Recording…' : 'Record it'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
