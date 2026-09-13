import { describe, test, expect } from 'vitest'
import { buildMonthlyEntryFromBankData, mergeMonthly, monthKey } from './monthlyHistory.js'

describe('buildMonthlyEntryFromBankData', () => {
  test('sums credits/debits into rev/exp/net and uses closing balance as cash', () => {
    const bd = {
      bankName: 'Absa',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      closingBalance: 61400,
      credits: [{ amount: 100000 }, { amount: 50000 }],
      debits: [{ amount: 30000 }, { amount: 20000 }],
    }
    const entry = buildMonthlyEntryFromBankData(bd)
    expect(entry.m).toBe('Jul')
    expect(entry.y).toBe(2026)
    expect(entry.rev).toBe(150000)
    expect(entry.exp).toBe(50000)
    expect(entry.net).toBe(100000)
    expect(entry.cash).toBe(61400)
    expect(entry.source).toBe('bank')
  })

  test('reports a loss when expenses exceed revenue', () => {
    const bd = {
      bankName: 'Nedbank', periodStart: '2026-01-01', periodEnd: '2026-01-31', closingBalance: 5000,
      credits: [{ amount: 1000 }], debits: [{ amount: 4000 }],
    }
    const entry = buildMonthlyEntryFromBankData(bd)
    expect(entry.net).toBe(-3000)
    expect(entry.take).toContain('loss')
  })

  test('falls back to the current month/year when dates are unparseable', () => {
    const bd = { periodStart: 'not-a-date', periodEnd: 'also-not-a-date', closingBalance: 0, credits: [], debits: [] }
    const entry = buildMonthlyEntryFromBankData(bd)
    const now = new Date()
    expect(entry.y).toBe(now.getFullYear())
  })
})

describe('mergeMonthly', () => {
  test('appends a reconciled month that does not exist in the base array', () => {
    const base = [{ m: 'Jun', y: 2026, net: 100 }]
    const reconciled = [{ m: 'Jul', y: 2026, net: 200 }]
    const result = mergeMonthly(base, reconciled)
    expect(result.map(mo => `${mo.m} ${mo.y}`)).toEqual(['Jun 2026', 'Jul 2026'])
  })

  test('a reconciled month overrides a base placeholder for the same period', () => {
    const base = [{ m: 'Jun', y: 2026, net: 0, take: 'No data yet' }]
    const reconciled = [{ m: 'Jun', y: 2026, net: 500, take: 'Reconciled' }]
    const result = mergeMonthly(base, reconciled)
    expect(result).toHaveLength(1)
    expect(result[0].net).toBe(500)
  })

  test('sorts chronologically across year boundaries', () => {
    const base = [{ m: 'Dec', y: 2025, net: 1 }, { m: 'Jan', y: 2026, net: 2 }]
    const reconciled = [{ m: 'Jul', y: 2026, net: 3 }]
    const result = mergeMonthly(base, reconciled)
    expect(result.map(mo => `${mo.m} ${mo.y}`)).toEqual(['Dec 2025', 'Jan 2026', 'Jul 2026'])
  })
})

describe('monthKey', () => {
  test('combines year and month into a stable key', () => {
    expect(monthKey(2026, 'Jul')).toBe('2026-Jul')
  })
})
