import { describe, test, expect } from 'vitest'
import { expenseEntry, supplierPaymentEntry, cashSaleEntry, ownerEntry, openingBalanceEntry, vatIncluded, entryBalanced } from './ledgerEntries'

const sum = (e, side) => e.lines.reduce((s, l) => s + l[side], 0)

describe('VAT that is already inside a price', () => {
  test('15% VAT inside R1 150,00 is R150,00 (rounded half up)', () => {
    expect(vatIncluded(115000)).toBe(15000)
    expect(vatIncluded(10000)).toBe(1304)     // 1 304.35 -> 1 304
    expect(vatIncluded(1)).toBe(0)
  })
})

describe('expense templates', () => {
  const base = { date: '2026-07-12', description: 'July rent', account: '6200', totalCents: 230000 }
  test('paid with VAT: debit the expense and VAT input, credit the bank', () => {
    const e = expenseEntry({ ...base, vat: true, paid: true })
    expect(e.lines).toEqual([{ account: '6200', debit: 200000, credit: 0 }, { account: '2210', debit: 30000, credit: 0 }, { account: '1000', debit: 0, credit: 230000 }])
    expect(entryBalanced(e)).toBe(true)
    expect(e.memo).toBe('July rent')
  })
  test('unpaid goes to creditors instead of the bank', () => {
    expect(expenseEntry({ ...base, vat: true, paid: false }).lines.at(-1)).toEqual({ account: '2000', debit: 0, credit: 230000 })
  })
  test('no VAT: just the expense and the payment', () => {
    const e = expenseEntry({ ...base, vat: false, paid: true })
    expect(e.lines).toEqual([{ account: '6200', debit: 230000, credit: 0 }, { account: '1000', debit: 0, credit: 230000 }])
  })
  test('the supplier name is added to the description', () => {
    expect(expenseEntry({ ...base, supplier: 'Landlord CC', vat: false, paid: true }).memo).toBe('July rent - Landlord CC')
  })
  test('refuses zero, negative, fractional or missing amounts', () => {
    for (const totalCents of [0, -5, 10.5, NaN, undefined]) expect(() => expenseEntry({ ...base, totalCents, vat: false, paid: true })).toThrow(/amount/i)
  })
})

describe('other templates', () => {
  test('paying a supplier clears creditors from the bank', () => {
    const e = supplierPaymentEntry({ date: '2026-07-20', description: 'Pay Landlord CC', amountCents: 115000 })
    expect(e.lines).toEqual([{ account: '2000', debit: 115000, credit: 0 }, { account: '1000', debit: 0, credit: 115000 }])
  })
  test('a cash sale splits into sales and VAT output', () => {
    const e = cashSaleEntry({ date: '2026-07-02', description: 'Till takings', totalCents: 115000, vat: true })
    expect(e.lines).toEqual([{ account: '1000', debit: 115000, credit: 0 }, { account: '4000', debit: 0, credit: 100000 }, { account: '2200', debit: 0, credit: 15000 }])
    expect(entryBalanced(e)).toBe(true)
  })
  test('a cash sale without VAT is all sales', () => {
    expect(cashSaleEntry({ date: '2026-07-02', description: 'x', totalCents: 5000, vat: false }).lines).toEqual([{ account: '1000', debit: 5000, credit: 0 }, { account: '4000', debit: 0, credit: 5000 }])
  })
  test('owner money in and out, and the opening bank balance', () => {
    expect(ownerEntry({ date: '2026-07-01', kind: 'contribution', amountCents: 50000 }).lines).toEqual([{ account: '1000', debit: 50000, credit: 0 }, { account: '3000', debit: 0, credit: 50000 }])
    expect(ownerEntry({ date: '2026-07-01', kind: 'drawing', amountCents: 50000 }).lines).toEqual([{ account: '3000', debit: 50000, credit: 0 }, { account: '1000', debit: 0, credit: 50000 }])
    expect(openingBalanceEntry({ date: '2026-06-01', bankCents: 10000000 })).toMatchObject({ memo: 'Opening bank balance', lines: [{ account: '1000', debit: 10000000, credit: 0 }, { account: '3000', debit: 0, credit: 10000000 }] })
    expect(() => ownerEntry({ date: '2026-07-01', kind: 'gift', amountCents: 5 })).toThrow()
  })
  test('entryBalanced catches an unbalanced or empty entry', () => {
    expect(entryBalanced({ lines: [{ account: '1000', debit: 5, credit: 0 }, { account: '3000', debit: 0, credit: 4 }] })).toBe(false)
    expect(entryBalanced({ lines: [] })).toBe(false)
    expect(sum(openingBalanceEntry({ date: '2026-06-01', bankCents: 7 }), 'debit')).toBe(7)
  })
})
