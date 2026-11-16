import { describe, test, expect } from 'vitest'
import { buildStatements } from './statements'
import { statementViews, money } from './statementRows'
import { accounts, totals } from './statementsFixture'

const s = buildStatements({ accounts, current: totals('2026-07-01', '2026-07-31'), prior: totals('2026-06-01', '2026-06-30'), from: '2026-07-01', to: '2026-07-31', priorFrom: '2026-06-01', priorTo: '2026-06-30' })
const v = statementViews(s, { periodLabel: 'July 2026', priorLabel: 'June 2026' })
const rows = (view) => view.rows.map((r) => [r.type, r.label, ...r.values])
const find = (view, label) => view.rows.find((r) => r.label === label)

describe('money in statements', () => {
  test('negatives go in brackets, zero is a dash', () => {
    expect(money(1150000)).toBe('R 11 500,00')
    expect(money(-250000)).toBe('(R 2 500,00)')
    expect(money(0)).toBe('–')
  })
})

describe('income statement view', () => {
  test('titles and columns', () => {
    expect(v.income).toMatchObject({ title: 'Income statement', subtitle: 'For July 2026', columns: ['July 2026', 'June 2026', 'Change'] })
  })
  test('revenue, expenses and profit with the change against the previous period', () => {
    expect(find(v.income, 'Sales').values).toEqual(['R 10 000,00', 'R 5 000,00', 'R 5 000,00 (+100%)'])
    expect(find(v.income, 'Other expenses').values).toEqual(['R 1 000,00', '–', 'R 1 000,00'])
    expect(find(v.income, 'Total revenue').type).toBe('total')
    expect(find(v.income, 'Profit for the period (before income tax)')).toMatchObject({ type: 'grand', values: ['R 7 000,00', 'R 4 000,00', 'R 3 000,00 (+75%)'] })
  })
  test('gross profit only appears when there is a cost of sales', () => {
    expect(find(v.income, 'Gross profit')).toBeUndefined()
  })
  test('without a comparison period the change column is empty', () => {
    const solo = statementViews(buildStatements({ accounts, current: totals('2026-07-01', '2026-07-31'), from: '2026-07-01', to: '2026-07-31' }), { periodLabel: 'July 2026' })
    expect(solo.income.columns).toEqual(['July 2026'])
    expect(find(solo.income, 'Sales').values).toEqual(['R 10 000,00'])
  })
})

describe('statement of financial position view', () => {
  test('is as at the end of the period, compared with the day before it began', () => {
    expect(v.balance).toMatchObject({ title: 'Statement of financial position', subtitle: 'As at 31 July 2026', columns: ['31 July 2026', '30 June 2026'] })
  })
  test('assets, liabilities and equity add up', () => {
    expect(find(v.balance, 'Bank').values).toEqual(['R 100 550,00', 'R 98 850,00'])
    expect(find(v.balance, 'Total assets').values).toEqual(['R 113 400,00', 'R 104 750,00'])
    expect(find(v.balance, 'Total liabilities').values[0]).toBe('R 3 400,00')
    expect(find(v.balance, 'Retained earnings').values[0]).toBe('R 11 000,00')
    expect(find(v.balance, 'Total equity and liabilities').values[0]).toBe('R 113 400,00')
  })
})

describe('statement of cash flows view', () => {
  test('operating, investing and financing down to the closing cash', () => {
    expect(v.cashFlow.title).toBe('Statement of cash flows')
    expect(find(v.cashFlow, 'Cash generated from operations').values).toEqual(['R 2 700,00'])
    expect(find(v.cashFlow, 'Owner drawings').values).toEqual(['(R 1 000,00)'])
    expect(find(v.cashFlow, 'Net increase or (decrease) in cash').values).toEqual(['R 1 700,00'])
    expect(find(v.cashFlow, 'Cash at the beginning of the period').values).toEqual(['R 98 850,00'])
    expect(find(v.cashFlow, 'Cash at the end of the period').values).toEqual(['R 100 550,00'])
  })
})

describe('statement of changes in equity view', () => {
  test('owner capital, retained earnings and total side by side', () => {
    expect(v.equity.columns).toEqual(['Owner equity', 'Retained earnings', 'Total'])
    expect(rows(v.equity).at(0)).toEqual(['total', 'Opening balance', 'R 100 000,00', 'R 4 000,00', 'R 104 000,00'])
    expect(rows(v.equity).at(-1)).toEqual(['grand', 'Closing balance', 'R 99 000,00', 'R 11 000,00', 'R 110 000,00'])
  })
})

describe('trial balance view', () => {
  test('debit and credit columns with equal totals', () => {
    expect(find(v.trial, '1000 Bank').values).toEqual(['R 100 550,00', ''])
    expect(find(v.trial, '2200 VAT output').values).toEqual(['', 'R 2 250,00'])
    const totalRow = find(v.trial, 'Totals')
    expect(totalRow.values[0]).toBe(totalRow.values[1])
  })
})
