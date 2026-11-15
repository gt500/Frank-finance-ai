import { describe, test, expect } from 'vitest'
import { buildStatements } from './statements'
import { statementViews } from './statementRows'

const accounts = [
  { code: '1000', name: 'Bank', type: 'asset' }, { code: '1200', name: 'Stock', type: 'asset' }, { code: '1500', name: 'Equipment', type: 'asset' },
  { code: '1510', name: 'Accumulated depreciation', type: 'asset' }, { code: '3000', name: 'Owner’s equity', type: 'equity' },
  { code: '3100', name: 'Retained earnings', type: 'equity' }, { code: '4000', name: 'Sales', type: 'income' },
  { code: '5000', name: 'Cost of sales', type: 'expense' }, { code: '6950', name: 'Depreciation', type: 'expense' },
]
const row = (account_code, pd = 0, pc = 0, od = 0, oc = 0) => ({ account_code, opening_debit: od, opening_credit: oc, period_debit: pd, period_credit: pc })

// Owner puts in R12 000, buys R12 000 of equipment, sells R5 000, charges R1 000 depreciation.
const ledger = [row('1000', 1700000, 1200000), row('1500', 1200000), row('1510', 0, 100000), row('3000', 0, 1200000), row('4000', 0, 500000), row('6950', 100000)]
const build = (extra = {}, rows = ledger) => buildStatements({ accounts, current: rows, prior: [], from: '2026-07-01', to: '2026-07-31', priorFrom: '2026-06-01', priorTo: '2026-06-30', ...extra })

describe('depreciation in the statements', () => {
  const s = build()
  test('is an expense that reduces profit and a deduction from equipment on the balance sheet', () => {
    expect(s.income.profit.cents).toBe(400000)
    expect(s.income.expenses.map((l) => [l.name, l.cents])).toEqual([['Depreciation', 100000]])
    expect(s.balance.nonCurrentAssets.map((l) => [l.name, l.cents])).toEqual([['Equipment', 1200000], ['Accumulated depreciation', -100000]])
    expect(s.balance.balanced).toBe(true)
  })
  test('is added back in the cash flow because no cash left the bank', () => {
    expect(s.cashFlow.operating.adjustments).toEqual([{ label: 'Depreciation (not a cash cost)', cents: 100000 }])
    expect(s.cashFlow.operating.total).toBe(500000)
    expect(s.cashFlow.investing.total).toBe(-1200000)
    expect(s.cashFlow.reconciles).toBe(true)
  })
})

describe('income tax estimate', () => {
  test('is the rate times profit before tax, shown below profit and never in the books', () => {
    const s = build({ taxRatePercent: 27 })
    expect(s.income.tax).toMatchObject({ ratePercent: 27, cents: 108000, afterCents: 292000 })
    expect(s.balance.balanced).toBe(true)
    expect(s.trialBalance.balanced).toBe(true)
    expect(s.income.profit.cents).toBe(400000)         // profit before tax is unchanged
  })
  test('is nil on a loss', () => {
    const s = build({ taxRatePercent: 27 }, [row('1000', 0, 50000), row('6950', 50000), row('1510', 0, 0), row('3000', 0, 0)])
    expect(s.income.profit.cents).toBeLessThan(0)
    expect(s.income.tax.cents).toBe(0)
  })
  test('is absent when no rate has been set', () => {
    expect(build().income.tax).toBeNull()
  })
  test('rounds to the nearest cent', () => {
    const s = build({ taxRatePercent: 27 }, [row('1000', 1001), row('4000', 0, 1001)])
    expect(s.income.tax.cents).toBe(270)               // 1001 × 27% = 270,27
  })
  test('appears as rows under the profit line, with the rate in the label', () => {
    const rows = statementViews(build({ taxRatePercent: 27 }), { periodLabel: 'July 2026' }).income.rows
    const labels = rows.map((r) => r.label)
    expect(labels.slice(-3)).toEqual(['Profit for the period (before income tax)', 'Estimated income tax at 27% (estimate, not in your books)', 'Estimated profit after income tax'])
    expect(rows.at(-1).values[0]).toBe('R 2 920,00')
    expect(rows.at(-2).values[0]).toBe('(R 1 080,00)')
  })
  test('no tax rows without a rate', () => {
    const labels = statementViews(build(), { periodLabel: 'July 2026' }).income.rows.map((r) => r.label)
    expect(labels.some((l) => /income tax at/.test(l))).toBe(false)
  })
})

describe('the note for accountants', () => {
  test('says what has and has not been recorded', () => {
    const none = build({}, [row('1000', 100), row('4000', 0, 100)]).accountantNotes.join(' ')
    expect(none).toMatch(/No equipment has been recorded/)
    expect(none).toMatch(/No stock count has been recorded/)
    expect(none).toMatch(/no rate has been set/)
    const all = build({ taxRatePercent: 27 }, [...ledger, row('1200', 300000), row('5000', 0, 300000)]).accountantNotes.join(' ')
    expect(all).toMatch(/straight-line/)
    expect(all).toMatch(/carried at the value entered at the last count/)
    expect(all).toMatch(/27% of profit before tax/)
  })
  test('mentions automatically categorised bank lines only when there are some', () => {
    expect(build().accountantNotes.join(' ')).not.toMatch(/bank statement line/)
    expect(build({ bankLinesPosted: 1 }).accountantNotes.join(' ')).toMatch(/1 bank statement line was categorised/)
    expect(build({ bankLinesPosted: 12 }).accountantNotes.join(' ')).toMatch(/12 bank statement lines were categorised/)
  })
  test('always ends by saying the statements are not audited or reviewed, and prints on the statement sheets', () => {
    const s = build()
    expect(s.accountantNotes.at(-1)).toMatch(/not audited or reviewed/)
    const views = statementViews(s, { periodLabel: 'July 2026' })
    expect(views.income.footnote).toBe(s.accountantNotes)
    expect(views.balance.footnote).toBe(s.accountantNotes)
    expect(views.cashFlow.footnote).toBe(s.accountantNotes)
  })
})
