import { useCallback, useEffect, useState } from 'react'
import { C } from '../../lib/theme'
import { formatRand } from '../../lib/invoicing'
import { documentModel, statementModel, longDate } from '../../lib/documentModel'
import * as api from '../../lib/invoiceApi'
import { Badge, Card, Empty, StatBox } from '../shared'
import { DocumentActions } from '../invoices/DocumentActions'
import { DocumentEditor } from '../invoices/DocumentEditor'
import { DocumentPreview } from '../invoices/DocumentPreview'
import { Notice } from '../invoices/fields'

const TABS = [['invoice', 'Invoices'], ['quote', 'Quotes'], ['statement', 'Statements']]

function StatusBadge({ doc, today }) {
  if (doc.status === 'issued' && doc.doc_type === 'invoice' && doc.due_date < today) return <Badge label="Overdue" color={C.watch} size="sm" />
  const map = { draft: ['Draft', C.label], issued: ['Issued', C.gold], paid: ['Paid', C.frank], void: ['Void', C.dim], converted: ['Converted', C.dim] }
  const [label, color] = map[doc.status] ?? [doc.status, C.dim]
  return <Badge label={label} color={color} size="sm" />
}

const ROW = { display: 'grid', gridTemplateColumns: 'minmax(80px,.7fr) minmax(140px,2fr) 140px 140px 120px 90px', gap: 10, alignItems: 'center', width: '100%', padding: '12px 6px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.07)', color: C.text, fontSize: 14, cursor: 'pointer' }

export function Invoices({ onNav }) {
  const [tab, setTab] = useState('invoice')
  const [docs, setDocs] = useState([])
  const [payments, setPayments] = useState([])
  const [settings, setSettings] = useState(null)
  const [mailbox, setMailbox] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState({ kind: 'list' })
  const [lines, setLines] = useState([])
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const today = api.todaySA()

  const reload = useCallback(async () => {
    try {
      const [d, p, s, m] = await Promise.all([api.listDocuments(), api.listPayments(), api.getSettings(), api.getMailbox()])
      setDocs(d); setPayments(p); setSettings(s); setMailbox(m); setLoadError('')
    } catch (e) { setLoadError(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])

  const doc = mode.kind === 'detail' ? docs.find((d) => d.id === mode.id) : null
  useEffect(() => {
    if (!doc) { setLines([]); return }
    let live = true
    api.getLines(doc.id).then((l) => live && setLines(l)).catch((e) => live && setNotice({ kind: 'error', text: e.message }))
    return () => { live = false }
  }, [doc?.id, doc?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = (fn, ok) => async (...args) => {
    setBusy(true); setNotice(null)
    try { const out = await fn(...args); await reload(); if (ok) setNotice({ kind: 'ok', text: typeof ok === 'function' ? ok(out) : ok }); return out }
    catch (e) { setNotice({ kind: 'error', text: e.message }) }
    finally { setBusy(false) }
  }

  const known = [...new Map(docs.map((d) => [d.customer_name, { name: d.customer_name, email: d.customer_email, address: d.customer_address, vat: d.customer_vat }])).values()]
  const startNew = (type) => { setNotice(null); setEditError(''); setMode({ kind: 'edit', draft: api.blankDraft(type, settings, today) }) }
  const startEdit = () => { setEditError(''); setMode({ kind: 'edit', draft: { ...doc, lines: api.toEditorLines(lines) } }) }
  const save = async (draft) => {
    setBusy(true); setEditError('')
    try { const saved = await api.saveDraft(draft); await reload(); setMode({ kind: 'detail', id: saved.id }); setNotice({ kind: 'ok', text: 'Draft saved.' }) }
    catch (e) { setEditError(e.message) } finally { setBusy(false) }
  }

  const sent = (out) => out?.simulated
    ? `Demo workspace: nothing was emailed. This would go to ${out.sentTo}.`
    : `Sent to ${out?.sentTo}.`

  if (loading) return <Empty message="Loading…" />
  if (loadError) return <Notice kind="error">Couldn't load your documents: {loadError}</Notice>

  const setupNeeded = !settings?.business_name?.trim()
  const outstanding = docs.reduce((s, d) => s + api.outstandingCents(d), 0)
  const overdue = docs.filter((d) => d.status === 'issued' && d.doc_type === 'invoice' && d.due_date < today).reduce((s, d) => s + api.outstandingCents(d), 0)
  const back = () => { setMode({ kind: 'list' }); setNotice(null) }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {setupNeeded && (
        <Notice>Add your business name, address and VAT number so documents carry them. <button type="button" className="btn-ghost" style={{ marginLeft: 8 }} onClick={() => onNav?.('connect')}>Add business details</button></Notice>
      )}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {mode.kind === 'list' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div role="tablist" style={{ display: 'flex', gap: 8 }}>
            {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'btn-gold' : 'btn-ghost'} onClick={() => setTab(id)}>{label}</button>)}
          </div>
          {tab !== 'statement' && <button type="button" className="btn-gold" onClick={() => startNew(tab)}>{tab === 'quote' ? 'New quote' : 'New invoice'}</button>}
        </div>

        {tab === 'invoice' && (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <StatBox label="Outstanding" value={formatRand(outstanding)} sub="Issued invoices not yet paid" color={C.frank} />
            <StatBox label="Overdue" value={formatRand(overdue)} sub={overdue ? 'Past their due date' : 'Nothing overdue'} color={overdue ? C.watch : C.frank} />
          </div>
        )}

        {tab !== 'statement' && (
          <Card title={tab === 'quote' ? 'Quotes' : 'Invoices'}>
            {docs.filter((d) => d.doc_type === tab).length === 0
              ? <Empty message={tab === 'quote' ? 'No quotes yet. Create your first quote.' : 'No invoices yet. Create your first invoice.'} />
              : <div role="table" aria-label={tab === 'quote' ? 'Quotes' : 'Invoices'}>
                {docs.filter((d) => d.doc_type === tab).map((d) => (
                  <button key={d.id} type="button" role="row" style={ROW} onClick={() => { setNotice(null); setMode({ kind: 'detail', id: d.id }) }}>
                    <span role="cell" className="num">{api.docLabel(d)}</span>
                    <span role="cell">{d.customer_name}</span>
                    <span role="cell" className="nowrap">{longDate(d.issue_date)}</span>
                    <span role="cell" className="nowrap">{longDate(d.due_date)}</span>
                    <span role="cell" className="num" style={{ textAlign: 'right' }}>{formatRand(Number(d.total_cents))}</span>
                    <span role="cell"><StatusBadge doc={d} today={today} /></span>
                  </button>
                ))}
              </div>}
          </Card>
        )}

        {tab === 'statement' && <StatementList docs={docs} payments={payments} today={today} onOpen={(c) => { setNotice(null); setMode({ kind: 'statement', customer: c }) }} />}
      </>}

      {mode.kind === 'edit' && (
        <Card title={mode.draft.id ? 'Edit draft' : mode.draft.doc_type === 'quote' ? 'New quote' : 'New invoice'}>
          <DocumentEditor initial={mode.draft} known={known} saving={busy} error={editError} onSave={save} onCancel={mode.draft.id ? () => setMode({ kind: 'detail', id: mode.draft.id }) : back} />
        </Card>
      )}

      {mode.kind === 'detail' && doc && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div><button type="button" className="btn-ghost" onClick={back}>← Back to {doc.doc_type === 'quote' ? 'quotes' : 'invoices'}</button></div>
          <Card title={`${api.docLabel(doc)} · ${doc.customer_name}`} sub={doc.sent_at ? `Last emailed to ${doc.last_sent_to} on ${longDate(doc.sent_at.slice(0, 10))}` : undefined}>
            <div style={{ marginBottom: 12 }}><StatusBadge doc={doc} today={today} /></div>
            <DocumentActions doc={doc} mailbox={mailbox} busy={busy}
              onEdit={startEdit}
              onIssue={act(() => api.issueDocument(doc.id), `${doc.doc_type === 'quote' ? 'Quote' : 'Invoice'} issued.`)}
              onSend={act(() => api.sendDocument(doc.id), sent)}
              onVoid={act(() => api.voidDocument(doc.id), 'Voided.')}
              onDelete={async () => { const ok = await act(() => api.deleteDraft(doc.id).then(() => true), 'Draft deleted.')(); if (ok) back() }}
              onConvert={async () => { const inv = await act(() => api.convertQuote(doc.id), 'Converted. Review the new invoice, then issue it.')(); if (inv?.id) { setTab('invoice'); setMode({ kind: 'detail', id: inv.id }) } }}
              onPay={act((cents, date, ref) => api.recordPayment(doc.id, cents, date, ref), 'Payment recorded.')} />
          </Card>
          <DocumentPreview model={documentModel(doc, lines, settings ?? undefined)} />
        </div>
      )}

      {mode.kind === 'statement' && (
        <StatementDetail entry={api.statementsFor(docs, payments, today).find((s) => s.customerName === mode.customer)} settings={settings} busy={busy} onBack={back}
          onSend={act(() => api.sendStatement(mode.customer), sent)} />
      )}
    </div>
  )
}

function StatementList({ docs, payments, today, onOpen }) {
  const rows = api.statementsFor(docs, payments, today)
  return (
    <Card title="Customer statements" sub="Customers who still owe you money. Open one to review it, then send it.">
      {rows.length === 0 ? <Empty message="Nobody owes you anything right now." /> : rows.map(({ customerName, statement }) => {
        const late = statement.closingCents - statement.aging.current
        return (
          <button key={customerName} type="button" style={{ ...ROW, gridTemplateColumns: 'minmax(160px,2fr) 130px 130px' }} onClick={() => onOpen(customerName)}>
            <span>{customerName}</span>
            <span className="num" style={{ textAlign: 'right', color: late ? C.watch : C.soft }}>{late ? `${formatRand(late)} overdue` : 'None overdue'}</span>
            <span className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{formatRand(statement.closingCents)}</span>
          </button>
        )
      })}
    </Card>
  )
}

function StatementDetail({ entry, settings, busy, onBack, onSend }) {
  const [confirm, setConfirm] = useState(false)
  if (!entry) return <div style={{ display: 'grid', gap: 12 }}><Empty message="This customer owes nothing now." /><div><button type="button" className="btn-ghost" onClick={onBack}>← Back</button></div></div>
  const model = statementModel(entry.statement, { name: entry.customerName, address: entry.address, vat: entry.vat }, settings ?? { business_name: '', address: '', vat_number: '', bank_details: '', footer_note: '' })
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div><button type="button" className="btn-ghost" onClick={onBack}>← Back to statements</button></div>
      <Card title={`Statement · ${entry.customerName}`}>
        {confirm
          ? <div role="alertdialog" aria-label="Confirm" style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14, color: C.text }}>Email this statement to {entry.email || 'the customer'}?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-gold" disabled={busy} onClick={async () => { await onSend(); setConfirm(false) }}>{busy ? 'Sending…' : 'Send now'}</button>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
          : <button type="button" className="btn-gold" onClick={() => setConfirm(true)}>Send statement by email</button>}
      </Card>
      <DocumentPreview model={model} />
    </div>
  )
}
