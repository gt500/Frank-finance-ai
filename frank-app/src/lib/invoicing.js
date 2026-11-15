// Pure invoicing logic: no network, no database. Shared by the UI and the Supabase edge functions
// (imported like billing.js and dunning.js), so the maths is written once and tested once.
// All money is WHOLE CENTS (integers) — never floats — so totals cannot drift by a cent.

export const VAT_RATE_PERCENT = 15
// Chart of accounts used by phase 1. The full small-business chart is seeded per tenant in the database.
export const ACCOUNTS = { BANK: '1000', DEBTORS: '1100', VAT_OUTPUT: '2200', SALES: '4000' }
const DOC_PREFIX = { invoice: 'INV', quote: 'QUO' }

// ── Money ────────────────────────────────────────────────────────────────────

/** Rand (number or text like "2250.50" / "2 250,50") → whole cents. Anything unreadable is 0. */
export function toCents(rand) {
  const n = typeof rand === 'number' ? rand : parseFloat(String(rand ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) : 0
}

/** Cents → "R 11 500,00" (South African format). */
export function formatRand(cents) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const lineTotalCents = (qty, unitCents) => Math.round(qty * unitCents)

/** VAT is worked out once on the document subtotal (not per line), rounded half up to the cent. */
export function documentTotals(lines, { vat }) {
  const subCents = lines.reduce((sum, l) => sum + lineTotalCents(l.qty, l.unitCents), 0)
  const vatCents = vat ? Math.round((subCents * VAT_RATE_PERCENT) / 100) : 0
  return { subCents, vatCents, totalCents: subCents + vatCents }
}

// ── Numbering & validation ───────────────────────────────────────────────────

/** INV-0047, QUO-0001 … grows past four digits (INV-12345). The next number itself is issued by the database. */
export function formatDocumentNumber(type, n) {
  const prefix = DOC_PREFIX[type]
  if (!prefix) throw new Error(`Unknown document type: ${type}`)
  if (!Number.isInteger(n) || n < 1) throw new Error('Document numbers start at 1')
  return `${prefix}-${String(n).padStart(4, '0')}`
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Everything wrong with a document, in plain English. An empty list means it is safe to send. */
export function validateDocument(doc) {
  const errors = []
  if (!doc.customerName?.trim()) errors.push('Customer name is required.')
  if (!doc.customerEmail?.trim()) errors.push('Customer email is required.')
  else if (!EMAIL.test(doc.customerEmail.trim())) errors.push('Customer email is not valid.')
  if (!doc.date) errors.push('Document date is required.')
  else if (doc.dueDate && doc.dueDate < doc.date) errors.push('The due date cannot be before the document date.')
  if (!doc.lines?.length) errors.push('Add at least one line item.')
  ;(doc.lines ?? []).forEach((l, i) => {
    const n = i + 1
    if (!l.description?.trim()) errors.push(`Line ${n}: add a description.`)
    if (!(l.qty > 0)) errors.push(`Line ${n}: quantity must be more than 0.`)
    if (!Number.isFinite(l.unitCents)) errors.push(`Line ${n}: price is required.`)
    else if (l.unitCents < 0) errors.push(`Line ${n}: price cannot be negative.`)
  })
  return errors
}

// ── Journal entries (double entry) ───────────────────────────────────────────

/** True only if there is at least one line, each line is a single positive debit OR credit, and debits equal credits. */
export function isBalanced(entry) {
  const lines = entry?.lines ?? []
  if (!lines.length) return false
  let debit = 0, credit = 0
  for (const l of lines) {
    const d = l.debitCents, c = l.creditCents
    if (!Number.isInteger(d) || !Number.isInteger(c) || d < 0 || c < 0 || (d > 0) === (c > 0)) return false
    debit += d
    credit += c
  }
  return debit === credit && debit > 0
}

/** Issuing an invoice: Debtors owe us the total; we have earned Sales plus VAT owed to SARS. */
export function buildInvoiceJournal({ number, date, customerName, subCents, vatCents, totalCents }) {
  if (!(totalCents > 0)) throw new Error('Invoice total must be more than 0')
  if (subCents + vatCents !== totalCents) throw new Error('Invoice total does not equal subtotal + VAT')
  return {
    date,
    memo: `Invoice ${number} — ${customerName}`,
    lines: [
      { account: ACCOUNTS.DEBTORS, debitCents: totalCents, creditCents: 0 },
      { account: ACCOUNTS.SALES, debitCents: 0, creditCents: subCents },
      ...(vatCents > 0 ? [{ account: ACCOUNTS.VAT_OUTPUT, debitCents: 0, creditCents: vatCents }] : []),
    ],
  }
}

/** A customer pays: money arrives in the bank and the customer no longer owes it. */
export function buildPaymentJournal({ invoiceNumber, date, amountCents }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('A payment must be more than 0')
  return {
    date,
    memo: `Payment received — ${invoiceNumber}`,
    lines: [
      { account: ACCOUNTS.BANK, debitCents: amountCents, creditCents: 0 },
      { account: ACCOUNTS.DEBTORS, debitCents: 0, creditCents: amountCents },
    ],
  }
}

/** Posted entries are never edited: a mistake is cancelled by posting the mirror image. Returns a new entry. */
export function buildReversal(entry, date) {
  return {
    date,
    memo: `Reversal of ${entry.memo}`,
    lines: entry.lines.map((l) => ({ account: l.account, debitCents: l.creditCents, creditCents: l.debitCents })),
  }
}

// ── Payment matching (proposals only: a person confirms) ─────────────────────

const GENERIC = new Set(['THE', 'AND', 'CENTRE', 'CENTER', 'SCHOOL', 'COMPANY', 'GROUP', 'TRADING', 'CARE', 'SERVICES', 'PTY', 'LTD'])
const squash = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')
const nameWords = (name) => String(name).toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length >= 4 && !GENERIC.has(w))
const TIER = { high: 3, medium: 2, low: 1 }

function assess(line, amountCents, inv) {
  const text = String(line.description ?? '').toUpperCase()
  const numberHit = squash(text).includes(squash(inv.number))
  const nameHit = nameWords(inv.customerName).some((w) => text.includes(w))
  const exact = amountCents === inv.outstandingCents
  const partial = amountCents < inv.outstandingCents

  let confidence = null, reason = ''
  if (numberHit && exact) { confidence = 'high'; reason = `The reference contains ${inv.number} and the amount matches exactly.` }
  else if (numberHit) { confidence = 'medium'; reason = `The reference contains ${inv.number} but the amount differs from what is owed.` }
  else if (exact && nameHit) { confidence = 'medium'; reason = `The amount matches ${inv.number} exactly and the description names ${inv.customerName}.` }
  else if (exact) { confidence = 'low'; reason = `The amount matches ${inv.number} exactly, but nothing in the description names the customer.` }
  else if (partial && nameHit) { confidence = 'low'; reason = `Looks like a part payment from ${inv.customerName} against ${inv.number}.` }
  return confidence && { invoiceId: inv.id, invoiceNumber: inv.number, confidence, reason, partial: partial && !exact }
}

/**
 * lines:    money-in bank lines [{ id, date, description, amount }]  (amount in rand)
 * invoices: open invoices      [{ id, number, customerName, outstandingCents }]
 * Returns proposals. A line that matches several invoices equally gets { invoiceId: null, ambiguous: [ids] }.
 * An invoice is proposed for at most one payment. Lines that match nothing are omitted.
 */
export function proposePaymentMatches(lines, invoices) {
  const singles = [], ambiguous = []
  lines.forEach((line, order) => {
    const amountCents = toCents(line.amount)
    if (amountCents <= 0) return
    const found = invoices.map((inv) => assess(line, amountCents, inv)).filter(Boolean)
    if (!found.length) return
    const top = Math.max(...found.map((f) => TIER[f.confidence]))
    const best = found.filter((f) => TIER[f.confidence] === top)
    const base = { lineId: line.id, amountCents, order }
    if (best.length > 1) ambiguous.push({ ...base, invoiceId: null, confidence: 'low', partial: false, ambiguous: best.map((b) => b.invoiceId), reason: 'More than one open invoice fits this payment — choose which one it settles.' })
    else singles.push({ ...base, ...best[0] })
  })

  const taken = new Set(), proposals = []
  for (const p of [...singles].sort((a, b) => TIER[b.confidence] - TIER[a.confidence] || a.order - b.order)) {
    if (taken.has(p.invoiceId)) continue
    taken.add(p.invoiceId)
    proposals.push(p)
  }
  return [...proposals, ...ambiguous].sort((a, b) => a.order - b.order).map(({ order, ...rest }) => rest)   // eslint-disable-line no-unused-vars
}
