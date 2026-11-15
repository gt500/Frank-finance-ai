import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { C } from '../../lib/theme'
import { formatRand, lineTotalCents, toCents } from '../../lib/invoicing'
import { draftTotals } from '../../lib/invoiceApi'
import { Field, inputStyle } from './fields'

/**
 * Create or edit a draft. `known` is the list of customers already used, so picking one fills in
 * their email, address and VAT number. Nothing is numbered or posted until the draft is issued.
 */
export function DocumentEditor({ initial, known = [], saving, error, onSave, onCancel }) {
  const [d, setD] = useState(initial)
  const isQuote = d.doc_type === 'quote'
  const totals = draftTotals(d.lines, d.vat_enabled)
  const set = (field) => (e) => setD({ ...d, [field]: e.target.value })

  const setCustomer = (e) => {
    const name = e.target.value
    const match = known.find((k) => k.name === name)
    setD({ ...d, customer_name: name, ...(match && !d.customer_email && !d.customer_address ? { customer_email: match.email, customer_address: match.address, customer_vat: match.vat } : {}) })
  }
  const setLine = (i, field) => (e) => setD({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, [field]: e.target.value } : l)) })
  const addLine = () => setD({ ...d, lines: [...d.lines, { description: '', qty: '1', price: '' }] })
  const removeLine = (i) => setD({ ...d, lines: d.lines.length > 1 ? d.lines.filter((_, j) => j !== i) : d.lines })

  const submit = (e) => { e.preventDefault(); if (!saving) onSave(d) }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Field label="Customer name">
          <input style={inputStyle} list="known-customers" value={d.customer_name} onChange={setCustomer} required />
          <datalist id="known-customers">{known.map((k) => <option key={k.name} value={k.name} />)}</datalist>
        </Field>
        <Field label="Customer email" hint="The document is sent to this address.">
          <input style={inputStyle} type="email" value={d.customer_email} onChange={set('customer_email')} />
        </Field>
        <Field label="Customer VAT number (optional)">
          <input style={inputStyle} value={d.customer_vat} onChange={set('customer_vat')} />
        </Field>
        <Field label="Customer address (optional)">
          <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={d.customer_address} onChange={set('customer_address')} />
        </Field>
        <Field label="Date"><input style={inputStyle} type="date" value={d.issue_date} onChange={set('issue_date')} required /></Field>
        <Field label={isQuote ? 'Valid until' : 'Due date'}><input style={inputStyle} type="date" value={d.due_date} min={d.issue_date} onChange={set('due_date')} required /></Field>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: C.text }}>
        <input type="checkbox" checked={d.vat_enabled} onChange={(e) => setD({ ...d, vat_enabled: e.target.checked })} />
        Charge 15% VAT on this {isQuote ? 'quote' : 'invoice'}
      </label>

      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend className="ttl" style={{ marginBottom: 10 }}>Line items</legend>
        <div style={{ display: 'grid', gap: 10 }}>
          {d.lines.map((l, i) => {
            const lineCents = lineTotalCents(Number(l.qty) || 0, toCents(l.price))
            return (
              <div key={i} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(160px, 3fr) 80px 120px 120px 36px', alignItems: 'end' }}>
                <Field label={i === 0 ? 'Description' : ' '}><input aria-label={`Line ${i + 1} description`} style={inputStyle} value={l.description} onChange={setLine(i, 'description')} /></Field>
                <Field label={i === 0 ? 'Qty' : ' '}><input aria-label={`Line ${i + 1} quantity`} style={inputStyle} inputMode="decimal" value={l.qty} onChange={setLine(i, 'qty')} /></Field>
                <Field label={i === 0 ? 'Unit price (R)' : ' '}><input aria-label={`Line ${i + 1} unit price`} style={inputStyle} inputMode="decimal" placeholder="0.00" value={l.price} onChange={setLine(i, 'price')} /></Field>
                <div className="num" style={{ minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: C.soft }}>{formatRand(lineCents)}</div>
                <button type="button" className="btn-ghost" aria-label={`Remove line ${i + 1}`} onClick={() => removeLine(i)} style={{ minHeight: 40, padding: 0 }}><Trash2 size={16} /></button>
              </div>
            )
          })}
        </div>
        <button type="button" className="btn-ghost" onClick={addLine} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Add a line</button>
      </fieldset>

      <Field label="Notes (optional)"><textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={d.notes} onChange={set('notes')} /></Field>

      <div style={{ marginLeft: 'auto', minWidth: 260 }} aria-live="polite">
        <Row k="Subtotal" v={formatRand(totals.subCents)} />
        {d.vat_enabled && <Row k="VAT 15%" v={formatRand(totals.vatCents)} />}
        <Row k="Total" v={formatRand(totals.totalCents)} strong />
      </div>

      {error && <div role="alert" style={{ color: C.danger, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="submit" className="btn-gold" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function Row({ k, v, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '3px 0', fontSize: strong ? 17 : 14, fontWeight: strong ? 700 : 400, color: strong ? C.bright : C.soft }}>
      <span>{k}</span><span className="num">{v}</span>
    </div>
  )
}
