import { MONTH_ABBR } from './monthlyHistory'

export const VAT_RATE = 0.15

function round2(n) {
  return Math.round(n * 100) / 100
}

function periodStartDate(period) {
  return new Date(period.y, MONTH_ABBR.indexOf(period.m), 1)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Avoid toISOString() here — it converts to UTC first, which shifts the
// calendar date backward in any timezone ahead of UTC (e.g. SAST, UTC+2).
function isoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function invoiceNumberFor(tenantId, seq) {
  const prefix = (tenantId || 'TEN').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
  return `ZEE-${prefix}-${String(seq).padStart(4, '0')}`
}

// Builds one Zeeder subscription tax invoice per billing period the tenant
// has been active, derived from their MONTHLY history (same source Reports
// and CashFlow use) — so invoice count naturally grows as months pass.
// Every period except the most recent is treated as paid; the current
// period is the single outstanding invoice.
export function buildInvoices(tenant, periods) {
  const planPrice = tenant.planPrice ?? 0
  return periods.map((period, i) => {
    const seq = i + 1
    const issueDate = periodStartDate(period)
    const dueDate = addDays(issueDate, 7)
    const vat = round2(planPrice * VAT_RATE)
    const total = round2(planPrice + vat)
    return {
      invoiceNumber: invoiceNumberFor(tenant.id, seq),
      period,
      issueDate: isoDate(issueDate),
      dueDate: isoDate(dueDate),
      lineItems: [{
        description: `${tenant.plan} Plan — Monthly Subscription (${period.m} ${period.y})`,
        qty: 1,
        unitPrice: planPrice,
        amount: planPrice,
      }],
      subtotal: planPrice,
      vatRate: VAT_RATE,
      vat,
      total,
      status: i === periods.length - 1 ? 'due' : 'paid',
    }
  })
}

// Builds a running statement of account from a tenant's invoice history —
// each paid invoice returns the balance to zero, the outstanding invoice
// (if any) carries through as the closing balance due.
export function buildStatement(invoices) {
  let balance = 0
  const rows = invoices.map(inv => {
    balance += inv.total
    const payment = inv.status === 'paid' ? inv.total : 0
    balance = round2(balance - payment)
    return { ...inv, payment, balance }
  })
  const balanceDue = round2(rows.reduce((s, r) => s + (r.status === 'due' ? r.total : 0), 0))
  return { rows, balanceDue }
}
