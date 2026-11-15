import { describe, test, expect } from 'vitest'
import { blankDraft, draftTotals, toEditorLines, docLabel, outstandingCents, statementsFor, addDays, linesToCents, isoDate, bankLineKey } from './invoiceApi'

describe('new drafts', () => {
  test('an invoice is due after the business payment terms, a quote is valid for 30 days', () => {
    expect(blankDraft('invoice', { payment_terms_days: 7 }, '2026-07-01')).toMatchObject({ doc_type: 'invoice', issue_date: '2026-07-01', due_date: '2026-07-08', vat_enabled: true })
    expect(blankDraft('invoice', null, '2026-07-01').due_date).toBe('2026-07-15')
    expect(blankDraft('quote', { payment_terms_days: 7 }, '2026-07-01').due_date).toBe('2026-07-31')
  })
  test('addDays crosses month and year ends', () => {
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08')
  })
  test('starts with one empty line', () => {
    expect(blankDraft('invoice', null, '2026-07-01').lines).toEqual([{ description: '', qty: '1', price: '' }])
  })
})

describe('what the editor shows while typing', () => {
  const lines = [{ description: 'Produce', qty: '4', price: '2250.00' }, { description: 'Delivery', qty: '4', price: '250' }]
  test('live totals use the same VAT rules as the server', () => {
    expect(draftTotals(lines, true)).toEqual({ subCents: 1000000, vatCents: 150000, totalCents: 1150000 })
    expect(draftTotals(lines, false)).toEqual({ subCents: 1000000, vatCents: 0, totalCents: 1000000 })
  })
  test('half-typed lines count as zero instead of breaking', () => {
    expect(draftTotals([{ description: '', qty: '', price: 'abc' }], true)).toEqual({ subCents: 0, vatCents: 0, totalCents: 0 })
  })
  test('lines go to the database in whole cents, and come back as rand text', () => {
    expect(linesToCents(lines)).toEqual([
      { description: 'Produce', qty: 4, unit_cents: 225000, position: 0 },
      { description: 'Delivery', qty: 4, unit_cents: 25000, position: 1 },
    ])
    expect(toEditorLines([{ description: 'Rice', qty: 1.5, unit_cents: 12345 }])).toEqual([{ description: 'Rice', qty: '1.5', price: '123.45' }])
  })
})

describe('labels and balances', () => {
  test('drafts have no number yet', () => {
    expect(docLabel({ doc_type: 'invoice', number: null })).toBe('Draft')
    expect(docLabel({ doc_type: 'invoice', number: 47 })).toBe('INV-0047')
    expect(docLabel({ doc_type: 'quote', number: 3 })).toBe('QUO-0003')
  })
  test('only an issued invoice has an outstanding balance', () => {
    expect(outstandingCents({ doc_type: 'invoice', status: 'issued', total_cents: 1150000, paid_cents: 400000 })).toBe(750000)
    for (const status of ['draft', 'paid', 'void']) expect(outstandingCents({ doc_type: 'invoice', status, total_cents: 100, paid_cents: 0 })).toBe(0)
    expect(outstandingCents({ doc_type: 'quote', status: 'issued', total_cents: 100, paid_cents: 0 })).toBe(0)
  })
})

describe('statementsFor — who owes what, as at a date', () => {
  const inv = (id, number, name, date, total, status = 'issued') => ({ id, doc_type: 'invoice', number, customer_name: name, customer_email: `${name[0]}@x.co`, customer_address: '', customer_vat: '', issue_date: date, due_date: date, total_cents: total, status })
  const docs = [inv('a', 1, 'Alpha', '2026-06-01', 100000), inv('b', 2, 'Alpha', '2026-07-01', 50000), inv('c', 3, 'Beta', '2026-07-01', 70000, 'paid'), inv('d', 4, 'Gamma', '2026-07-01', 90000), { ...inv('e', 5, 'Gamma', '2026-07-02', 10000, 'draft') }]
  const payments = [{ document_id: 'a', amount_cents: 40000, paid_on: '2026-06-20' }, { document_id: 'c', amount_cents: 70000, paid_on: '2026-07-05' }]
  const out = statementsFor(docs, payments, '2026-08-01')
  test('lists only customers who still owe money, biggest first', () => {
    expect(out.map((s) => [s.customerName, s.statement.closingCents])).toEqual([['Alpha', 110000], ['Gamma', 90000]])
  })
  test('carries the latest email so a statement can be sent', () => {
    expect(out[0].email).toBe('A@x.co')
  })
})

describe('bank statement dates and line keys', () => {
  test('dates from statements become ISO dates', () => {
    expect(isoDate('2026-06-03')).toBe('2026-06-03')
    expect(isoDate('2026-06-03T10:00:00Z')).toBe('2026-06-03')
    expect(isoDate('03/06/2026')).toBe('2026-06-03')
    expect(isoDate('3-6-2026')).toBe('2026-06-03')
    expect(isoDate('2026/06/03')).toBe('2026-06-03')
  })
  test('anything unreadable falls back to the given day', () => {
    expect(isoDate('last tuesday', '2026-07-01')).toBe('2026-07-01')
    expect(isoDate(undefined, '2026-07-01')).toBe('2026-07-01')
    expect(isoDate('31/02/2026', '2026-07-01')).toBe('2026-07-01')
  })
  test('a bank line has a stable key, so a payment is never applied twice', () => {
    expect(bankLineKey({ id: 'cr-0', date: '2026-06-03', amount: 7245 })).toBe('cr-0|2026-06-03|7245')
  })
})
