import { describe, test, expect } from 'vitest'
import { buildInvoices, buildStatement, invoiceNumberFor, VAT_RATE } from './invoice.js'

const tenant = { id: 'wonderland-educare', plan: 'Starter', planPrice: 499 }
const periods = [
  { m: 'May', y: 2026 },
  { m: 'Jun', y: 2026 },
  { m: 'Jul', y: 2026 },
]

describe('invoiceNumberFor', () => {
  test('builds a stable, sequential invoice number from the tenant id', () => {
    expect(invoiceNumberFor('wonderland-educare', 1)).toBe('ZEE-WONDER-0001')
    expect(invoiceNumberFor('wonderland-educare', 12)).toBe('ZEE-WONDER-0012')
  })
})

describe('buildInvoices', () => {
  test('creates one invoice per billing period with correct VAT and totals', () => {
    const invoices = buildInvoices(tenant, periods)
    expect(invoices).toHaveLength(3)
    const first = invoices[0]
    expect(first.subtotal).toBe(499)
    expect(first.vatRate).toBe(VAT_RATE)
    expect(first.vat).toBe(74.85)
    expect(first.total).toBe(573.85)
    expect(first.lineItems[0].description).toBe('Starter Plan — Monthly Subscription (May 2026)')
  })

  test('only the most recent period is due — all earlier periods are paid', () => {
    const invoices = buildInvoices(tenant, periods)
    expect(invoices[0].status).toBe('paid')
    expect(invoices[1].status).toBe('paid')
    expect(invoices[2].status).toBe('due')
  })

  test('due date is 7 days after the invoice issue date', () => {
    const [invoice] = buildInvoices(tenant, [{ m: 'Jul', y: 2026 }])
    expect(invoice.issueDate).toBe('2026-07-01')
    expect(invoice.dueDate).toBe('2026-07-08')
  })

  test('invoice numbers are sequential across periods', () => {
    const invoices = buildInvoices(tenant, periods)
    expect(invoices.map(i => i.invoiceNumber)).toEqual([
      'ZEE-WONDER-0001', 'ZEE-WONDER-0002', 'ZEE-WONDER-0003',
    ])
  })
})

describe('buildStatement', () => {
  test('running balance returns to zero after each paid invoice and carries the due invoice as the closing balance', () => {
    const invoices = buildInvoices(tenant, periods)
    const { rows, balanceDue } = buildStatement(invoices)
    expect(rows[0].balance).toBe(0)
    expect(rows[1].balance).toBe(0)
    expect(rows[2].balance).toBe(573.85)
    expect(balanceDue).toBe(573.85)
  })

  test('balance due is zero when every invoice is paid', () => {
    const paidOnly = buildInvoices(tenant, [{ m: 'Jun', y: 2026 }]).map(i => ({ ...i, status: 'paid' }))
    const { balanceDue } = buildStatement(paidOnly)
    expect(balanceDue).toBe(0)
  })
})
