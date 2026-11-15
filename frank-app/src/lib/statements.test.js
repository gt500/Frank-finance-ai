import { describe, test, expect } from 'vitest'
import { buildStatements } from './statements'

import { accounts, entries, totals } from './statementsFixture'

const july = buildStatements({ accounts, current: totals('2026-07-01', '2026-07-31'), prior: totals('2026-06-01', '2026-06-30'), from: '2026-07-01', to: '2026-07-31', priorFrom: '2026-06-01', priorTo: '2026-06-30' })
const line = (list, code) => list.find((l) => l.code === code)

describe('income statement', () => {
  test('revenue, expenses and profit for the period, with the prior period beside them', () => {
    expect(line(july.income.revenue, '4000')).toMatchObject({ name: 'Sales', cents: 1000000, priorCents: 500000 })
    expect(july.income.totalRevenue).toEqual({ cents: 1000000, priorCents: 500000 })
    expect(july.income.expenses.map((e) => [e.code, e.cents, e.priorCents])).toEqual([['6200', 200000, 100000], ['6900', 100000, 0]])
    expect(july.income.totalExpenses).toEqual({ cents: 300000, priorCents: 100000 })
    expect(july.income.profit).toEqual({ cents: 700000, priorCents: 400000 })
    expect(july.income.grossProfit).toEqual({ cents: 1000000, priorCents: 500000 })
  })
  test('anything dated after the period is left out', () => {
    expect(line(july.income.expenses, '6900').cents).toBe(100000)
  })
  test('margins are percentages of revenue', () => {
    expect(july.income.margins).toEqual({ gross: 100, net: 70 })
  })
  test('big movements are flagged as favourable or unfavourable', () => {
    const f = Object.fromEntries(july.income.flags.map((x) => [x.label, x]))
    expect(f['Sales']).toMatchObject({ varianceCents: 500000, pct: 100, direction: 'favourable' })
    expect(f['Rent']).toMatchObject({ varianceCents: 100000, pct: 100, direction: 'unfavourable' })
    expect(f['Other expenses']).toMatchObject({ varianceCents: 100000, pct: null, direction: 'unfavourable' })
  })
  test('small movements are not flagged', () => {
    const small = buildStatements({
      accounts,
      current: [{ account_code: '4000', opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 105000 }],
      prior: [{ account_code: '4000', opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 100000 }],
      from: '2026-07-01', to: '2026-07-31', priorFrom: '2026-06-01', priorTo: '2026-06-30',
    })
    expect(small.income.flags).toEqual([])
  })
})

describe('statement of financial position (balance sheet)', () => {
  const b = july.balance
  test('assets and liabilities at the end of the period, with the opening position beside them', () => {
    expect(b.currentAssets.map((a) => [a.code, a.cents, a.priorCents])).toEqual([['1000', 10055000, 9885000], ['1100', 1225000, 575000], ['2210', 60000, 15000]])
    expect(b.totalAssets).toEqual({ cents: 11340000, priorCents: 10475000 })
    expect(b.currentLiabilities.map((a) => [a.code, a.cents, a.priorCents])).toEqual([['2000', 115000, 0], ['2200', 225000, 75000]])
    expect(b.totalLiabilities).toEqual({ cents: 340000, priorCents: 75000 })
  })
  test('equity is owner capital less drawings plus all profit earned so far', () => {
    expect(b.equity.map((e) => [e.name, e.cents, e.priorCents])).toEqual([['Owner equity', 9900000, 10000000], ['Retained earnings', 1100000, 400000]])
    expect(b.totalEquity).toEqual({ cents: 11000000, priorCents: 10400000 })
  })
  test('assets always equal liabilities plus equity', () => {
    expect(b.balanced).toBe(true)
    expect(b.totalLiabilitiesAndEquity.cents).toBe(b.totalAssets.cents)
  })
  test('equipment is a non-current asset and loans a non-current liability', () => {
    const more = [...entries, ['2026-07-25', [['1500', 300000, 0], ['2300', 0, 300000]]]]
    const s = buildStatements({ accounts, current: totals('2026-07-01', '2026-07-31', more), from: '2026-07-01', to: '2026-07-31' })
    expect(s.balance.nonCurrentAssets.map((x) => [x.code, x.cents])).toEqual([['1500', 300000]])
    expect(s.balance.nonCurrentLiabilities.map((x) => [x.code, x.cents])).toEqual([['2300', 300000]])
    expect(s.balance.balanced).toBe(true)
    expect(s.cashFlow.investing.total).toBe(-300000)
    expect(s.cashFlow.financing.lines.find((l) => l.label === 'Loans raised or (repaid)').cents).toBe(300000)
    expect(s.cashFlow.reconciles).toBe(true)
  })
})

describe('statement of cash flows (indirect method)', () => {
  const c = july.cashFlow
  test('profit adjusted for what moved in debtors, VAT and creditors gives cash from operations', () => {
    expect(c.operating.profit).toBe(700000)
    expect(c.operating.adjustments).toEqual([
      { label: 'Decrease or (increase) in debtors', cents: -650000 },
      { label: 'Decrease or (increase) in VAT receivable', cents: -45000 },
      { label: 'Increase or (decrease) in creditors', cents: 115000 },
      { label: 'Increase or (decrease) in VAT payable', cents: 150000 },
    ])
    expect(c.operating.total).toBe(270000)
  })
  test('owner drawings are financing; nothing was invested', () => {
    expect(c.financing.lines).toEqual([{ label: 'Owner contributions', cents: 0 }, { label: 'Owner drawings', cents: -100000 }])
    expect(c.financing.total).toBe(-100000)
    expect(c.investing.total).toBe(0)
  })
  test('the net movement equals the change in the bank balance', () => {
    expect([c.net, c.opening, c.closing]).toEqual([170000, 9885000, 10055000])
    expect(c.reconciles).toBe(true)
  })
})

describe('statement of changes in equity', () => {
  test('opening, profit, owner money and closing, split between owner capital and retained earnings', () => {
    expect(july.equityMovement.rows).toEqual([
      { label: 'Opening balance', equityCents: 10000000, retainedCents: 400000, totalCents: 10400000 },
      { label: 'Profit for the period', equityCents: 0, retainedCents: 700000, totalCents: 700000 },
      { label: 'Owner contributions', equityCents: 0, retainedCents: 0, totalCents: 0 },
      { label: 'Owner drawings', equityCents: -100000, retainedCents: 0, totalCents: -100000 },
      { label: 'Closing balance', equityCents: 9900000, retainedCents: 1100000, totalCents: 11000000 },
    ])
  })
})

describe('trial balance', () => {
  test('every account with a balance at the end of the period; debits equal credits', () => {
    const t = july.trialBalance
    expect(t.rows.find((r) => r.code === '1000')).toEqual({ code: '1000', name: 'Bank', debitCents: 10055000, creditCents: 0 })
    expect(t.rows.find((r) => r.code === '2200')).toEqual({ code: '2200', name: 'VAT output', debitCents: 0, creditCents: 225000 })
    expect(t.totalDebit).toBe(t.totalCredit)
    expect(t.balanced).toBe(true)
  })
})

describe('an empty ledger', () => {
  test('produces zero statements instead of failing', () => {
    const s = buildStatements({ accounts, current: [], from: '2026-07-01', to: '2026-07-31' })
    expect(s.income.profit).toEqual({ cents: 0, priorCents: null })
    expect(s.balance.totalAssets.cents).toBe(0)
    expect(s.balance.balanced).toBe(true)
    expect(s.cashFlow.reconciles).toBe(true)
    expect(s.income.margins).toEqual({ gross: null, net: null })
  })
})
