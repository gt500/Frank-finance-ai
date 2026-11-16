import { describe, test, expect } from 'vitest'
import {
  toCents, formatRand, lineTotalCents, documentTotals, formatDocumentNumber,
  validateDocument, buildInvoiceJournal, buildPaymentJournal, buildReversal, isBalanced,
  proposePaymentMatches, agingBucket, buildStatement, ACCOUNTS,
} from './invoicing.js'

const plain = (s) => s.normalize('NFKC')   // the locale uses non-breaking spaces; NFKC turns them into plain spaces

describe('money is whole cents', () => {
  test('toCents converts rand strings and numbers without float drift', () => {
    expect(toCents('2250.50')).toBe(225050)
    expect(toCents(0.1 + 0.2)).toBe(30)            // 0.30000000000000004
    expect(toCents('')).toBe(0)
    expect(toCents('abc')).toBe(0)
  })

  test('formatRand shows two decimals in the South African format', () => {
    expect(plain(formatRand(1150000))).toBe('R 11 500,00')
    expect(plain(formatRand(5))).toBe('R 0,05')
  })
})

describe('line and document totals', () => {
  test('line total = quantity × unit price, rounded to the cent', () => {
    expect(lineTotalCents(4, 225000)).toBe(900000)
    expect(lineTotalCents(1.5, 333)).toBe(500)      // 499.5 rounds half up
  })

  test('VAT is 15% of the subtotal, calculated once on the document', () => {
    const lines = [{ qty: 4, unitCents: 225000 }, { qty: 4, unitCents: 25000 }]
    expect(documentTotals(lines, { vat: true })).toEqual({ subCents: 1000000, vatCents: 150000, totalCents: 1150000 })
  })

  test('a non-VAT vendor gets no VAT line', () => {
    expect(documentTotals([{ qty: 1, unitCents: 10000 }], { vat: false })).toEqual({ subCents: 10000, vatCents: 0, totalCents: 10000 })
  })

  test('VAT rounds half up to the nearest cent', () => {
    expect(documentTotals([{ qty: 1, unitCents: 1 }], { vat: true }).vatCents).toBe(0)     // 0.15 → 0
    expect(documentTotals([{ qty: 1, unitCents: 10 }], { vat: true }).vatCents).toBe(2)    // 1.5 → 2
  })

  test('an empty document totals zero', () => {
    expect(documentTotals([], { vat: true })).toEqual({ subCents: 0, vatCents: 0, totalCents: 0 })
  })
})

describe('document numbers', () => {
  test('are prefixed, zero-padded and keep growing past four digits', () => {
    expect(formatDocumentNumber('invoice', 47)).toBe('INV-0047')
    expect(formatDocumentNumber('quote', 1)).toBe('QUO-0001')
    expect(formatDocumentNumber('invoice', 12345)).toBe('INV-12345')
  })

  test('rejects an unknown type or a number below 1', () => {
    expect(() => formatDocumentNumber('receipt', 1)).toThrow()
    expect(() => formatDocumentNumber('invoice', 0)).toThrow()
  })
})

describe('validateDocument — checked before anything is sent', () => {
  const good = { customerName: 'Durbanville Catering Co.', customerEmail: 'accounts@durbanvillecatering.co.za', date: '2026-07-01', dueDate: '2026-07-15',
    lines: [{ description: 'Fresh produce', qty: 4, unitCents: 225000 }] }

  test('a complete document has no errors', () => {
    expect(validateDocument(good)).toEqual([])
  })

  test('reports each missing or invalid field', () => {
    const errors = validateDocument({ ...good, customerName: ' ', customerEmail: 'not-an-email', dueDate: '2026-06-01', lines: [] })
    expect(errors).toContain('Customer name is required.')
    expect(errors).toContain('Customer email is not valid.')
    expect(errors).toContain('The due date cannot be before the document date.')
    expect(errors).toContain('Add at least one line item.')
  })

  test('rejects lines with no description, a zero quantity or a negative price', () => {
    const errors = validateDocument({ ...good, lines: [{ description: '', qty: 0, unitCents: -5 }] })
    expect(errors).toContain('Line 1: add a description.')
    expect(errors).toContain('Line 1: quantity must be more than 0.')
    expect(errors).toContain('Line 1: price cannot be negative.')
  })
})

describe('journals — debits always equal credits', () => {
  const invoice = { number: 'INV-0047', date: '2026-07-01', customerName: 'Durbanville Catering Co.', subCents: 1000000, vatCents: 150000, totalCents: 1150000 }

  test('issuing an invoice: debit Debtors, credit Sales and VAT output', () => {
    const je = buildInvoiceJournal(invoice)
    expect(je.lines).toEqual([
      { account: ACCOUNTS.DEBTORS, debitCents: 1150000, creditCents: 0 },
      { account: ACCOUNTS.SALES, debitCents: 0, creditCents: 1000000 },
      { account: ACCOUNTS.VAT_OUTPUT, debitCents: 0, creditCents: 150000 },
    ])
    expect(je.memo).toContain('INV-0047')
    expect(isBalanced(je)).toBe(true)
  })

  test('a no-VAT invoice has no VAT line and still balances', () => {
    const je = buildInvoiceJournal({ ...invoice, vatCents: 0, totalCents: 1000000 })
    expect(je.lines).toHaveLength(2)
    expect(isBalanced(je)).toBe(true)
  })

  test('refuses to build an invoice journal whose total does not equal subtotal + VAT', () => {
    expect(() => buildInvoiceJournal({ ...invoice, totalCents: 1 })).toThrow(/does not equal/)
  })

  test('receiving a payment: debit Bank, credit Debtors', () => {
    const je = buildPaymentJournal({ invoiceNumber: 'INV-0047', date: '2026-07-20', amountCents: 1150000 })
    expect(je.lines).toEqual([
      { account: ACCOUNTS.BANK, debitCents: 1150000, creditCents: 0 },
      { account: ACCOUNTS.DEBTORS, debitCents: 0, creditCents: 1150000 },
    ])
    expect(isBalanced(je)).toBe(true)
  })

  test('a payment must be more than zero', () => {
    expect(() => buildPaymentJournal({ invoiceNumber: 'INV-1', date: '2026-07-20', amountCents: 0 })).toThrow()
  })

  test('a reversal swaps every debit and credit and leaves the original untouched', () => {
    const je = buildInvoiceJournal(invoice)
    const rev = buildReversal(je, '2026-07-05')
    expect(rev.lines[0]).toEqual({ account: ACCOUNTS.DEBTORS, debitCents: 0, creditCents: 1150000 })
    expect(rev.memo).toMatch(/^Reversal of /)
    expect(isBalanced(rev)).toBe(true)
    expect(je.lines[0].debitCents).toBe(1150000)
  })

  test('isBalanced rejects unbalanced, empty and two-sided lines', () => {
    expect(isBalanced({ lines: [{ account: '1000', debitCents: 100, creditCents: 0 }, { account: '1100', debitCents: 0, creditCents: 99 }] })).toBe(false)
    expect(isBalanced({ lines: [] })).toBe(false)
    expect(isBalanced({ lines: [{ account: '1000', debitCents: 100, creditCents: 100 }] })).toBe(false)
  })
})

describe('proposePaymentMatches — proposes, never decides', () => {
  const invoices = [
    { id: 'a', number: 'INV-0044', customerName: 'Kuils River Frail Care Centre', outstandingCents: 724500 },
    { id: 'b', number: 'INV-0045', customerName: 'Durbanville Catering Co.', outstandingCents: 299000 },
    { id: 'c', number: 'INV-0046', customerName: 'Bellville Primary School', outstandingCents: 380000 },
  ]
  const line = (id, description, amount) => ({ id, date: '2026-07-20', description, amount })

  test('invoice number in the reference + exact amount = high confidence', () => {
    const [p] = proposePaymentMatches([line('t1', 'EFT KURILS RIVER INV-0044', 7245)], invoices)
    expect(p).toMatchObject({ lineId: 't1', invoiceId: 'a', confidence: 'high' })
    expect(p.reason).toMatch(/INV-0044/)
  })

  test('exact amount + customer name, no invoice number = medium', () => {
    const [p] = proposePaymentMatches([line('t2', 'PAYMENT FROM DURBANVILLE CATERING', 2990)], invoices)
    expect(p).toMatchObject({ invoiceId: 'b', confidence: 'medium' })
  })

  test('a smaller payment from a known customer is a low-confidence part payment', () => {
    const [p] = proposePaymentMatches([line('t3', 'EFT BELLVILLE PRIMARY', 1000)], invoices)
    expect(p).toMatchObject({ invoiceId: 'c', confidence: 'low', partial: true })
  })

  test('an amount that matches but names nobody is only low confidence', () => {
    const [p] = proposePaymentMatches([line('t4', 'CASH DEPOSIT', 7245)], invoices)
    expect(p).toMatchObject({ invoiceId: 'a', confidence: 'low' })
  })

  test('two invoices with the same amount and no other clue is ambiguous: no single proposal', () => {
    const twins = [
      { id: 'x', number: 'INV-1', customerName: 'Alpha', outstandingCents: 50000 },
      { id: 'y', number: 'INV-2', customerName: 'Beta', outstandingCents: 50000 },
    ]
    const [p] = proposePaymentMatches([line('t5', 'CASH DEPOSIT', 500)], twins)
    expect(p.invoiceId).toBeNull()
    expect(p.ambiguous.sort()).toEqual(['x', 'y'])
  })

  test('each invoice is proposed for at most one payment', () => {
    const result = proposePaymentMatches([line('t6', 'INV-0044', 7245), line('t7', 'INV-0044 again', 7245)], invoices)
    expect(result.filter((r) => r.invoiceId === 'a')).toHaveLength(1)
  })

  test('lines that match nothing are left out', () => {
    expect(proposePaymentMatches([line('t8', 'WOOLWORTHS PURCHASE', 123.45)], invoices)).toEqual([])
  })
})

describe('ageing — how late is an unpaid invoice', () => {
  test('not yet due, or due today, is current', () => {
    expect(agingBucket('2026-08-10', '2026-08-01')).toBe('current')
    expect(agingBucket('2026-08-10', '2026-08-10')).toBe('current')
  })
  test('buckets by whole days past the due date', () => {
    expect(agingBucket('2026-08-10', '2026-08-11')).toBe('d1_30')
    expect(agingBucket('2026-08-10', '2026-09-09')).toBe('d1_30')   // 30 days
    expect(agingBucket('2026-08-10', '2026-09-10')).toBe('d31_60')  // 31 days
    expect(agingBucket('2026-08-10', '2026-10-09')).toBe('d31_60')  // 60 days
    expect(agingBucket('2026-08-10', '2026-10-10')).toBe('d61_90')  // 61 days
    expect(agingBucket('2026-08-10', '2026-11-08')).toBe('d61_90')  // 90 days
    expect(agingBucket('2026-08-10', '2026-11-09')).toBe('d90plus') // 91 days
  })
})

describe('buildStatement — what one customer owes, line by line', () => {
  const invoices = [
    { number: 'INV-0001', date: '2026-06-01', dueDate: '2026-06-15', totalCents: 100000, status: 'issued' },
    { number: 'INV-0002', date: '2026-07-01', dueDate: '2026-07-15', totalCents: 250000, status: 'issued' },
    { number: 'INV-0003', date: '2026-07-20', dueDate: '2026-08-03', totalCents: 90000, status: 'void' },
    { number: 'INV-0004', date: '2026-07-25', dueDate: '2026-08-08', totalCents: 70000, status: 'draft' },
  ]
  const payments = [{ invoiceNumber: 'INV-0001', date: '2026-06-20', amountCents: 40000 }]
  const s = buildStatement({ customerName: 'Durbanville Catering Co.', invoices, payments, asOf: '2026-08-01' })

  test('lists invoices and payments in date order with a running balance', () => {
    expect(s.lines.map((l) => [l.ref, l.debitCents, l.creditCents, l.balanceCents])).toEqual([
      ['INV-0001', 100000, 0, 100000],
      ['INV-0001', 0, 40000, 60000],
      ['INV-0002', 250000, 0, 310000],
    ])
  })
  test('leaves out void and draft invoices', () => {
    expect(s.lines.some((l) => l.ref === 'INV-0003' || l.ref === 'INV-0004')).toBe(false)
  })
  test('closing balance is what is still owed', () => {
    expect(s.closingCents).toBe(310000)
  })
  test('ageing splits the outstanding amount by how late each invoice is', () => {
    expect(s.aging).toEqual({ current: 0, d1_30: 250000, d31_60: 60000, d61_90: 0, d90plus: 0 })
    expect(Object.values(s.aging).reduce((a, b) => a + b, 0)).toBe(s.closingCents)
  })
  test('ignores anything dated after the statement date', () => {
    const early = buildStatement({ customerName: 'X', invoices, payments, asOf: '2026-06-10' })
    expect(early.closingCents).toBe(100000)
  })
  test('a customer who owes nothing has a zero statement', () => {
    const paid = buildStatement({ customerName: 'X', invoices: [invoices[0]], payments: [{ invoiceNumber: 'INV-0001', date: '2026-06-20', amountCents: 100000 }], asOf: '2026-08-01' })
    expect(paid.closingCents).toBe(0)
    expect(paid.aging).toEqual({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 })
  })
})
