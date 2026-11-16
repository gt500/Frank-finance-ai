import { useState } from 'react'
import { C } from '../../lib/theme'
import { toCents, formatRand } from '../../lib/invoicing'
import { docLabel, outstandingCents, todaySA } from '../../lib/invoiceApi'
import { Field, inputStyle } from './fields'

/**
 * What can be done with a document right now. Everything that changes the books asks first:
 * issuing numbers it and locks it, sending emails the customer, voiding posts a reversal.
 */
export function DocumentActions({ doc, mailbox, busy, onEdit, onDelete, onIssue, onSend, onVoid, onConvert, onPay }) {
  const [confirm, setConfirm] = useState(null)
  const [paying, setPaying] = useState(false)
  const out = outstandingCents(doc)
  const [pay, setPay] = useState({ amount: (out / 100).toFixed(2), date: todaySA(), reference: '' })
  const label = docLabel(doc)
  const isQuote = doc.doc_type === 'quote'
  const sendable = ['issued', 'paid', 'converted'].includes(doc.status)

  const run = (fn) => async () => { setConfirm(null); setPaying(false); await fn() }
  const prompts = {
    issue: { text: `Issue this ${isQuote ? 'quote' : 'invoice'}? It gets its number and can't be edited afterwards.`, go: onIssue, cta: 'Issue' },
    send: { text: `Send ${label} to ${doc.customer_email || 'the customer'} from ${mailbox?.from_email || 'your mailbox'}?`, go: onSend, cta: 'Send now' },
    void: { text: `Void ${label}? ${isQuote ? '' : 'A reversing entry is posted to your books. '}The ${isQuote ? 'quote' : 'invoice'} stays on record as void.`, go: onVoid, cta: 'Void' },
    delete: { text: 'Delete this draft? This can\'t be undone.', go: onDelete, cta: 'Delete' },
  }
  const ask = (kind) => <button type="button" className={kind === 'send' || kind === 'issue' ? 'btn-gold' : 'btn-ghost'} disabled={busy} onClick={() => { setConfirm(kind); setPaying(false) }}>{
    { issue: `Issue ${isQuote ? 'quote' : 'invoice'}`, send: doc.sent_at ? 'Resend by email' : 'Send by email', void: 'Void', delete: 'Delete draft' }[kind]}</button>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {doc.status === 'draft' && <>{ask('issue')}<button type="button" className="btn-ghost" disabled={busy} onClick={onEdit}>Edit</button>{ask('delete')}</>}
        {sendable && ask('send')}
        {doc.doc_type === 'invoice' && doc.status === 'issued' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setPaying(true); setConfirm(null) }}>Record payment</button>}
        {isQuote && doc.status === 'issued' && <button type="button" className="btn-ghost" disabled={busy} onClick={run(onConvert)}>Convert to invoice</button>}
        {doc.status === 'issued' && !(doc.paid_cents > 0) && ask('void')}
      </div>

      {confirm && (
        <div role="alertdialog" aria-label="Confirm" className="glass" style={{ padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 14, color: C.text }}>{prompts[confirm].text}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn-gold" disabled={busy} onClick={run(prompts[confirm].go)}>{busy ? 'Working…' : prompts[confirm].cta}</button>
            <button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {paying && (
        <form className="glass" style={{ padding: 14, display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); run(() => onPay(toCents(pay.amount), pay.date, pay.reference.trim()))() }}>
          <div style={{ fontSize: 14, color: C.text }}>Outstanding on {label}: <strong className="num">{formatRand(out)}</strong></div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Field label="Amount received (R)"><input style={inputStyle} inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required /></Field>
            <Field label="Date received"><input style={inputStyle} type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} required /></Field>
            <Field label="Reference (optional)"><input style={inputStyle} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-gold" disabled={busy}>Record payment</button>
            <button type="button" className="btn-ghost" onClick={() => setPaying(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
