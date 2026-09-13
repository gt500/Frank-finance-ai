import { describe, test, expect } from 'vitest'
import { buildTransactionsCsv, buildDebtorsCsv, buildCreditorsCsv, buildStatementCsv } from './exportCsv.js'

describe('buildTransactionsCsv', () => {
  test('combines credits and debits, sorted by date, debits as negative amounts, mapped to a GL account', () => {
    const bankData = {
      credits: [{ date: '2026-01-15', description: 'Fee payment', entityName: 'Smith Family', category: 'School Fees', amount: 1500 }],
      debits: [{ date: '2026-01-02', description: 'Rent', entityName: 'Landlord', category: 'Rent', amount: 4000 }],
    }
    const csv = buildTransactionsCsv(bankData)
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Date,Description,Entity,Category,Account Code,Account,Amount')
    expect(lines[1]).toBe('2026-01-02,Rent,Landlord,Rent,6100,Rent & Occupancy,-4000')
    expect(lines[2]).toBe('2026-01-15,Fee payment,Smith Family,School Fees,4000,Sales / Fees Income,1500')
  })

  test('falls back to Uncategorized for unmapped categories', () => {
    const bankData = {
      credits: [{ date: '2026-01-01', description: 'Mystery deposit', entityName: 'A', category: 'Some Weird Label', amount: 50 }],
      debits: [],
    }
    expect(buildTransactionsCsv(bankData)).toContain('9999,Uncategorized')
  })

  test('a per-tenant custom mapping overrides the default', () => {
    const bankData = {
      credits: [{ date: '2026-01-01', description: 'x', entityName: 'A', category: 'Some Weird Label', amount: 50 }],
      debits: [],
    }
    expect(buildTransactionsCsv(bankData, { 'Some Weird Label': '4900' })).toContain('4900,Other Income')
  })

  test('escapes commas in description', () => {
    const bankData = {
      credits: [{ date: '2026-01-01', description: 'Payment, thanks', entityName: 'A', category: 'Other', amount: 100 }],
      debits: [],
    }
    expect(buildTransactionsCsv(bankData)).toContain('"Payment, thanks"')
  })
})

describe('buildDebtorsCsv', () => {
  test('maps debtor fields with fallback names', () => {
    const csv = buildDebtorsCsv([{ name: 'Jane Doe', reference: 'INV-1', amount: 500, due_date: '2026-02-01', days_overdue: 10 }])
    expect(csv.split('\r\n')[1]).toBe('Jane Doe,INV-1,500,2026-02-01,10')
  })
})

describe('buildCreditorsCsv', () => {
  test('maps creditor fields with fallback names', () => {
    const csv = buildCreditorsCsv([{ name: 'Supplier Co', ref: 'BILL-1', amount: 200, due: '2026-02-10', overdue: true }])
    expect(csv.split('\r\n')[1]).toBe('Supplier Co,BILL-1,200,2026-02-10,Yes')
  })
})

describe('buildStatementCsv', () => {
  test('maps statement rows including VAT breakdown and running balance', () => {
    const rows = [{
      invoiceNumber: 'ZEE-WONDER-0001', issueDate: '2026-07-01', dueDate: '2026-07-08',
      lineItems: [{ description: 'Starter Plan — Monthly Subscription (Jul 2026)' }],
      subtotal: 499, vat: 74.85, total: 573.85, payment: 573.85, balance: 0, status: 'paid',
    }]
    const csv = buildStatementCsv(rows)
    expect(csv.split('\r\n')[1]).toBe('ZEE-WONDER-0001,2026-07-01,2026-07-08,Starter Plan — Monthly Subscription (Jul 2026),499,74.85,573.85,573.85,0,Paid')
  })
})
