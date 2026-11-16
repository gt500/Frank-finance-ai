// Guided transactions for the books: each builds a balanced journal entry from plain inputs, in the shape the
// database function post_manual_journal expects ({ account, debit, credit } in whole cents). The database
// checks the balance again, so a bug here can never put an unbalanced entry in the ledger.
import { VAT_RATE_PERCENT } from './invoicing'

const BANK = '1000', CREDITORS = '2000', VAT_INPUT = '2210', VAT_OUTPUT = '2200', OWNER = '3000', SALES = '4000'

const amount = (cents) => {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error('Enter an amount greater than zero.')
  return cents
}
const text = (s) => {
  const t = String(s ?? '').trim()
  if (!t) throw new Error('Add a short description.')
  return t
}
const dr = (account, debit) => ({ account, debit, credit: 0 })
const cr = (account, credit) => ({ account, debit: 0, credit })

/** The VAT already inside a price that includes VAT (15% inside R1 150,00 is R150,00). */
export const vatIncluded = (totalCents) => Math.round((totalCents * VAT_RATE_PERCENT) / (100 + VAT_RATE_PERCENT))

/** Debits equal credits, every line has exactly one side, and there is something to post. */
export function entryBalanced(entry) {
  const { lines } = entry
  if (!lines.length || lines.some((l) => (l.debit > 0) === (l.credit > 0))) return false
  const d = lines.reduce((s, l) => s + l.debit, 0)
  const c = lines.reduce((s, l) => s + l.credit, 0)
  return d === c && d > 0
}

/** Money spent. `totalCents` is what was paid or is owed, VAT included. Unpaid goes to creditors. */
export function expenseEntry({ date, description, supplier, account, totalCents, vat, paid }) {
  const total = amount(totalCents)
  const tax = vat ? vatIncluded(total) : 0
  const memo = supplier?.trim() ? `${text(description)} - ${supplier.trim()}` : text(description)
  return {
    date, memo,
    lines: [dr(account, total - tax), ...(tax > 0 ? [dr(VAT_INPUT, tax)] : []), cr(paid ? BANK : CREDITORS, total)],
  }
}

/** Paying a supplier you already owe. */
export function supplierPaymentEntry({ date, description, amountCents }) {
  const a = amount(amountCents)
  return { date, memo: text(description), lines: [dr(CREDITORS, a), cr(BANK, a)] }
}

/** Takings that never went through an invoice (a till, a market stall). `totalCents` includes VAT. */
export function cashSaleEntry({ date, description, totalCents, vat }) {
  const total = amount(totalCents)
  const tax = vat ? vatIncluded(total) : 0
  return { date, memo: text(description), lines: [dr(BANK, total), cr(SALES, total - tax), ...(tax > 0 ? [cr(VAT_OUTPUT, tax)] : [])] }
}

/** The owner puts money in, or takes money out. */
export function ownerEntry({ date, kind, amountCents }) {
  const a = amount(amountCents)
  if (kind === 'contribution') return { date, memo: 'Owner contribution', lines: [dr(BANK, a), cr(OWNER, a)] }
  if (kind === 'drawing') return { date, memo: 'Owner drawings', lines: [dr(OWNER, a), cr(BANK, a)] }
  throw new Error('Choose contribution or drawing.')
}

/** What was in the bank when you started using Zeeder (the balancing side is the owner's equity). */
export function openingBalanceEntry({ date, bankCents }) {
  const a = amount(bankCents)
  return { date, memo: 'Opening bank balance', lines: [dr(BANK, a), cr(OWNER, a)] }
}
