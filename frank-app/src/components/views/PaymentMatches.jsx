import { useCallback, useEffect, useState } from 'react'
import { C } from '../../lib/theme'
import { formatRand, proposePaymentMatches, toCents } from '../../lib/invoicing'
import * as api from '../../lib/invoiceApi'
import { Card, ConfBadge } from '../shared'
import { Notice } from '../invoices/fields'

/**
 * Zeeder PROPOSES which unpaid invoice each money-in line settles; nothing changes until the client confirms.
 * Confirming records the payment (Dr Bank / Cr Debtors). The bank line's key goes into the payment reference,
 * so a line that has been applied is never proposed again.
 */
export function PaymentMatches({ credits }) {
  const [docs, setDocs] = useState([])
  const [payments, setPayments] = useState([])
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState('')
  const [skipped, setSkipped] = useState(() => new Set())

  const load = useCallback(async () => {
    try { const [d, p] = await Promise.all([api.listDocuments(), api.listPayments()]); setDocs(d); setPayments(p) }
    catch (e) { setNotice({ kind: 'error', text: `Couldn't check your invoices: ${e.message}` }) }
    finally { setReady(true) }
  }, [])
  useEffect(() => { load() }, [load])

  const invoices = docs.filter((d) => api.outstandingCents(d) > 0)
    .map((d) => ({ id: d.id, number: api.docLabel(d), customerName: d.customer_name, outstandingCents: api.outstandingCents(d) }))
  const applied = (line) => payments.some((p) => (p.reference || '').includes(api.bankLineKey(line)))
  const open = credits.filter((c) => !applied(c) && !skipped.has(c.id))
  const proposals = proposePaymentMatches(open.map((c) => ({ id: c.id, date: c.date, description: c.description, amount: c.amount })), invoices)
  const lineOf = (id) => credits.find((c) => c.id === id)

  if (!ready && !notice) return null
  if (invoices.length === 0 || proposals.length === 0) return notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null

  const confirm = async (line, invoiceId) => {
    setBusy(line.id); setNotice(null)
    try {
      const inv = invoices.find((i) => i.id === invoiceId)
      const cents = Math.min(toCents(line.amount), inv.outstandingCents)
      await api.recordPayment(invoiceId, cents, api.isoDate(line.date), `Bank ${api.bankLineKey(line)} ${line.description}`.slice(0, 200))
      await load()
      setNotice({ kind: 'ok', text: `Recorded ${formatRand(cents)} against ${inv.number}.` })
    } catch (e) { setNotice({ kind: 'error', text: e.message }) } finally { setBusy('') }
  }
  const skip = (id) => setSkipped(new Set([...skipped, id]))

  return (
    <Card title="Payments to match" sub="Zeeder suggests which unpaid invoice each payment settles. Nothing is marked paid until you confirm.">
      {notice && <div style={{ marginBottom: 12 }}><Notice kind={notice.kind}>{notice.text}</Notice></div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {proposals.map((p) => {
          const line = lineOf(p.lineId)
          const inv = invoices.find((i) => i.id === p.invoiceId)
          const choices = (p.ambiguous ?? []).map((id) => invoices.find((i) => i.id === id)).filter(Boolean)
          return (
            <div key={p.lineId} className="glass" style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
                <span><strong className="num">{formatRand(toCents(line.amount))}</strong> received {line.date} · {line.description}</span>
                {inv && <ConfBadge value={p.confidence} />}
              </div>
              {inv && <div style={{ fontSize: 14, color: C.soft }}>
                Looks like <strong style={{ color: C.text }}>{inv.number}</strong> for {inv.customerName} ({formatRand(inv.outstandingCents)} outstanding). {p.reason}.
                {p.partial && ' This is less than the full amount, so it would be a part payment.'}
              </div>}
              {!inv && <div style={{ fontSize: 14, color: C.soft }}>This amount matches more than one invoice, so Zeeder can't choose. Which one is it?</div>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {inv && <button type="button" className="btn-gold" disabled={!!busy} onClick={() => confirm(line, inv.id)}>{busy === line.id ? 'Recording…' : `Confirm: mark ${inv.number} ${p.partial ? 'part paid' : 'paid'}`}</button>}
                {choices.map((c) => <button key={c.id} type="button" className="btn-ghost" disabled={!!busy} onClick={() => confirm(line, c.id)}>{c.number} · {c.customerName}</button>)}
                <button type="button" className="btn-ghost" onClick={() => skip(line.id)}>Not an invoice payment</button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
