// Everything the invoicing screens need from the database and the edge functions, plus the small pure
// helpers around it. Writes only ever create/edit DRAFTS directly; issuing, paying, voiding and converting
// go through database functions that number, total and post to the ledger (see 20261115a_invoicing_ledger.sql).
import { supabase } from './supabaseClient'
import { documentTotals, formatDocumentNumber, toCents, buildStatement } from './invoicing'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// ── Pure helpers ──────────────────────────────────────────────────────────────────────────────
export const todaySA = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())

export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

/** A new, empty draft. Invoices fall due after the business's payment terms; quotes are valid for 30 days. */
export function blankDraft(type, settings, today = todaySA()) {
  const days = type === 'quote' ? 30 : (settings?.payment_terms_days ?? 14)
  return {
    id: null, doc_type: type, customer_name: '', customer_email: '', customer_address: '', customer_vat: '',
    issue_date: today, due_date: addDays(today, days), vat_enabled: true, notes: '',
    lines: [{ description: '', qty: '1', price: '' }],
  }
}

/** Live totals while typing: rand text in, whole cents out, half-typed values count as zero. */
export const draftTotals = (lines, vat) =>
  documentTotals(lines.map((l) => ({ qty: Number(l.qty) || 0, unitCents: toCents(l.price) })), { vat })

export const linesToCents = (lines) =>
  lines.map((l, i) => ({ description: l.description.trim(), qty: Number(l.qty) || 0, unit_cents: toCents(l.price), position: i }))

export const toEditorLines = (rows) =>
  rows.map((r) => ({ description: r.description, qty: String(Number(r.qty)), price: (Number(r.unit_cents) / 100).toFixed(2) }))

/** A date from a bank statement (ISO, dd/mm/yyyy or yyyy/mm/dd) as YYYY-MM-DD; `fallback` when it can't be read. */
export function isoDate(raw, fallback = todaySA()) {
  const s = String(raw ?? '').trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) || s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/) ||
    (() => { const d = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); return d && [d[0], d[3], d[2], d[1]] })()
  if (!m) return fallback
  const iso = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : fallback
}

/** Identifies one bank statement line inside a payment reference, so the same line can't be applied twice. */
export const bankLineKey = (line) => `${line.id}|${line.date}|${line.amount}`

export const docLabel = (d) => (d.number ? formatDocumentNumber(d.doc_type, d.number) : 'Draft')

export const outstandingCents = (d) => (d.doc_type === 'invoice' && d.status === 'issued' ? Number(d.total_cents) - Number(d.paid_cents || 0) : 0)

/** One statement per customer who still owes money, biggest balance first. */
export function statementsFor(docs, payments, asOf) {
  const invoices = docs.filter((d) => d.doc_type === 'invoice' && (d.status === 'issued' || d.status === 'paid'))
  const numberOf = new Map(invoices.map((d) => [d.id, docLabel(d)]))
  const byCustomer = new Map()
  for (const d of invoices) byCustomer.set(d.customer_name, [...(byCustomer.get(d.customer_name) ?? []), d])
  return [...byCustomer.entries()].map(([customerName, list]) => {
    const latest = [...list].sort((a, b) => b.issue_date.localeCompare(a.issue_date) || b.number - a.number)[0]
    const statement = buildStatement({
      customerName, asOf,
      invoices: list.map((d) => ({ number: numberOf.get(d.id), date: d.issue_date, dueDate: d.due_date, totalCents: Number(d.total_cents), status: d.status })),
      payments: payments.filter((p) => numberOf.has(p.document_id) && list.some((d) => d.id === p.document_id))
        .map((p) => ({ invoiceNumber: numberOf.get(p.document_id), date: p.paid_on, amountCents: Number(p.amount_cents) })),
    })
    return { customerName, email: latest.customer_email, address: latest.customer_address, vat: latest.customer_vat, statement }
  }).filter((s) => s.statement.closingCents > 0).sort((a, b) => b.statement.closingCents - a.statement.closingCents)
}

// ── Database ──────────────────────────────────────────────────────────────────────────────────
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data }

export async function listDocuments() {
  return must(await supabase.from('documents').select('*').order('created_at', { ascending: false }))
}
export async function listPayments() {
  return must(await supabase.from('document_payments').select('document_id, amount_cents, paid_on, reference'))
}
export async function getLines(documentId) {
  return must(await supabase.from('document_lines').select('description, qty, unit_cents').eq('document_id', documentId).order('position'))
}

/** Create or update a draft and replace its lines. Totals written here are previews; the database recomputes on issue. */
export async function saveDraft(draft) {
  const totals = draftTotals(draft.lines, draft.vat_enabled)
  const fields = {
    doc_type: draft.doc_type, customer_name: draft.customer_name.trim(), customer_email: draft.customer_email.trim(),
    customer_address: draft.customer_address.trim(), customer_vat: draft.customer_vat.trim(),
    issue_date: draft.issue_date, due_date: draft.due_date, vat_enabled: draft.vat_enabled, notes: draft.notes.trim(),
    sub_cents: totals.subCents, vat_cents: totals.vatCents, total_cents: totals.totalCents,
  }
  const doc = draft.id
    ? must(await supabase.from('documents').update(fields).eq('id', draft.id).select().single())
    : must(await supabase.from('documents').insert(fields).select().single())
  must(await supabase.from('document_lines').delete().eq('document_id', doc.id))
  const lines = linesToCents(draft.lines).filter((l) => l.description)
  if (lines.length) must(await supabase.from('document_lines').insert(lines.map((l) => ({ ...l, document_id: doc.id }))))
  return doc
}
export async function deleteDraft(id) { must(await supabase.from('documents').delete().eq('id', id)) }

const rpc = async (fn, args) => must(await supabase.rpc(fn, args))
export const issueDocument = (id) => rpc('issue_document', { p_id: id })
export const convertQuote = (id) => rpc('convert_quote', { p_id: id })
export const voidDocument = (id) => rpc('void_document', { p_id: id })
export const recordPayment = (id, amountCents, paidOn, reference = '') =>
  rpc('record_payment', { p_id: id, p_amount_cents: amountCents, p_paid_on: paidOn, p_reference: reference })

// ── Settings and mailbox ──────────────────────────────────────────────────────────────────────
export async function getSettings() {
  return must(await supabase.from('invoice_settings').select('*').maybeSingle())
}
export async function saveSettings(s) {
  return must(await supabase.from('invoice_settings').upsert({
    business_name: s.business_name.trim(), address: s.address.trim(), vat_number: s.vat_number.trim(),
    payment_terms_days: Number(s.payment_terms_days) || 14, bank_details: s.bank_details.trim(), footer_note: s.footer_note.trim(),
    updated_at: new Date().toISOString(),
  }).select().single())
}
export async function getMailbox() {
  return must(await supabase.from('tenant_mailboxes').select('host, port, security, username, from_name, from_email, verified_at').maybeSingle())
}

// ── Edge functions (the session token proves who is asking; the server decides the tenant) ──────
async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in again.')
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body),
    })
  } catch { throw new Error("Couldn't reach Zeeder. Check your connection and try again.") }
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.')
  return out
}
export const sendDocument = (documentId) => callFunction('send-document', { kind: 'document', document_id: documentId })
export const sendStatement = (customerName) => callFunction('send-document', { kind: 'statement', customer_name: customerName })
export const connectMailbox = (form) => callFunction('mailbox', { action: 'save', ...form })
export const disconnectMailbox = () => callFunction('mailbox', { action: 'disconnect' })
