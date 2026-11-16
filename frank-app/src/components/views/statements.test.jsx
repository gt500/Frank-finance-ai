import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { accounts, totals } from '../../lib/statementsFixture'

const ledger = vi.hoisted(() => ({
  getChartAccounts: vi.fn(), getLedgerTotals: vi.fn(), postEntry: vi.fn(), reverseEntry: vi.fn(), listRecordedEntries: vi.fn(),
  postDepreciation: vi.fn(), getTaxRate: vi.fn(), countPostedBankLines: vi.fn(), listFixedAssets: vi.fn(), addFixedAsset: vi.fn(), voidFixedAsset: vi.fn(),
  postStockCount: vi.fn(), saveTaxRate: vi.fn(),
}))
vi.mock('../../lib/ledgerApi', () => ledger)
vi.mock('../../lib/invoiceApi', async (orig) => ({ ...(await orig()), getSettings: async () => ({ business_name: 'Cape Fresh Grocery' }) }))

import { FinancialStatements } from './FinancialStatements'

// The tests choose the dates themselves, so they never depend on today's date.
async function openJuly() {
  render(<FinancialStatements />)
  fireEvent.change(await screen.findByLabelText('Period'), { target: { value: 'custom' } })
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-01' } })
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-31' } })
}
const sheet = (name) => screen.findByRole('article', { name })

beforeEach(() => {
  Object.values(ledger).forEach((f) => f.mockReset())
  ledger.getChartAccounts.mockResolvedValue(accounts)
  ledger.getLedgerTotals.mockImplementation(async (from, to) => totals(from, to))
  ledger.listRecordedEntries.mockResolvedValue([])
  ledger.postDepreciation.mockResolvedValue(0)
  ledger.getTaxRate.mockResolvedValue(null)
  ledger.countPostedBankLines.mockResolvedValue(0)
  ledger.listFixedAssets.mockResolvedValue([])
})

describe('Financial statements', () => {
  test('a ledger with nothing in it explains what to do instead of showing zeros', async () => {
    ledger.getLedgerTotals.mockResolvedValue([])
    render(<FinancialStatements />)
    expect(await screen.findByText('Nothing recorded for these dates yet')).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  test('income statement for July with June beside it, and the movements worth a look', async () => {
    await openJuly()
    const s = await sheet('Income statement')
    expect(within(s).getByText('Cape Fresh Grocery')).toBeTruthy()
    expect(within(s).getByText('For 1 July 2026 to 31 July 2026')).toBeTruthy()
    expect(within(s).getByText('Profit for the period (before income tax)')).toBeTruthy()
    expect(within(s).getAllByText('R 7 000,00').length).toBeGreaterThan(0)
    expect(within(s).getAllByText('R 5 000,00 (+100%)').length).toBeGreaterThan(0)
    expect(screen.getByText('Worth a look')).toBeTruthy()
    expect(screen.getAllByText(/favourable/).length).toBeGreaterThan(0)
    expect(screen.getByText('Net margin:').querySelector('strong').textContent).toBe('70%')
  })

  test('each statement is a tab', async () => {
    await openJuly()
    await sheet('Income statement')
    fireEvent.click(screen.getByRole('tab', { name: 'Financial position' }))
    const bs = await sheet('Statement of financial position')
    expect(within(bs).getAllByText('R 113 400,00').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Cash flows' }))
    const cf = await sheet('Statement of cash flows')
    expect(within(cf).getByText('Cash at the end of the period')).toBeTruthy()
    expect(within(cf).getAllByText('R 100 550,00').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Changes in equity' }))
    expect(await sheet('Statement of changes in equity')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Trial balance' }))
    expect(within(await sheet('Trial balance')).getByText('Totals')).toBeTruthy()
  })

  test('depreciation is posted before the numbers are read, and the income tax estimate and accountant note appear on the sheet', async () => {
    ledger.getTaxRate.mockResolvedValue(27)
    ledger.countPostedBankLines.mockResolvedValue(4)
    await openJuly()
    const s = await sheet('Income statement')
    expect(ledger.postDepreciation).toHaveBeenCalled()
    expect(ledger.postDepreciation.mock.invocationCallOrder[0]).toBeLessThan(ledger.getLedgerTotals.mock.invocationCallOrder[0])
    expect(within(s).getByText('Estimated profit after income tax')).toBeTruthy()
    expect(within(s).getByText(/Estimated income tax at 27%/)).toBeTruthy()
    const note = within(s).getByLabelText('Note for your accountant')
    expect(note.textContent).toMatch(/4 bank statement lines were categorised/)
    expect(note.textContent).toMatch(/not audited or reviewed/)
  })

  test('without a tax rate the sheet shows profit before tax only', async () => {
    await openJuly()
    const s = await sheet('Income statement')
    expect(within(s).queryByText('Estimated profit after income tax')).toBeNull()
    expect(within(s).getByLabelText('Note for your accountant').textContent).toMatch(/no rate has been set/)
  })

  test('a failure to post depreciation is shown instead of numbers that leave it out', async () => {
    ledger.postDepreciation.mockRejectedValue(new Error('Not signed in'))
    render(<FinancialStatements />)
    expect(await screen.findByText(/Couldn't load your statements: Not signed in/)).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })

  test('statements that do not balance are called out loudly', async () => {
    ledger.getLedgerTotals.mockResolvedValue([{ account_code: '1000', opening_debit: 0, opening_credit: 0, period_debit: 5000, period_credit: 0 }])
    render(<FinancialStatements />)
    expect(await screen.findByText(/do not balance/)).toBeTruthy()
  })

  test('an invalid custom range is explained and nothing is fetched for it', async () => {
    await openJuly()
    await sheet('Income statement')
    ledger.getLedgerTotals.mockClear()
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } })   // after the end date
    expect(await screen.findByText('The end date cannot be before the start date.')).toBeTruthy()
    expect(screen.queryByRole('article', { name: 'Income statement' })).toBeNull()          // no stale numbers under a bad period
    expect(ledger.getLedgerTotals).not.toHaveBeenCalled()
  })
})

describe('Recording a transaction', () => {
  test('shows exactly what will be recorded, then records it once', async () => {
    ledger.postEntry.mockResolvedValue('e1')
    await openJuly()
    await sheet('Income statement')
    fireEvent.click(screen.getByText('Record a transaction'))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-12' } })
    fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value: 'July rent' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '6200' } })
    fireEvent.change(screen.getByLabelText(/^Amount \(R\)/), { target: { value: '2300' } })
    const preview = screen.getByLabelText('What will be recorded')
    expect(within(preview).getByText('Debit · Rent').nextSibling.textContent).toBe('R 2 000,00')
    expect(within(preview).getByText('Debit · VAT input').nextSibling.textContent).toBe('R 300,00')
    expect(within(preview).getByText('Credit · Bank').nextSibling.textContent).toBe('R 2 300,00')
    expect(ledger.postEntry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Record it'))
    await waitFor(() => expect(ledger.postEntry).toHaveBeenCalledTimes(1))
    expect(ledger.postEntry.mock.calls[0][0]).toEqual({
      date: '2026-07-12', memo: 'July rent',
      lines: [{ account: '6200', debit: 200000, credit: 0 }, { account: '2210', debit: 30000, credit: 0 }, { account: '1000', debit: 0, credit: 230000 }],
    })
    expect(await screen.findByText('Recorded.')).toBeTruthy()
  })

  test('an unpaid expense is owed to creditors', async () => {
    await openJuly()
    await sheet('Income statement')
    fireEvent.click(screen.getByText('Record a transaction'))
    fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value: 'Stationery' } })
    fireEvent.change(screen.getByLabelText(/^Amount \(R\)/), { target: { value: '115' } })
    fireEvent.click(screen.getByLabelText(/Already paid/))
    expect(within(screen.getByLabelText('What will be recorded')).getByText('Credit · Creditors (trade payables)')).toBeTruthy()
  })

  test('the opening bank balance needs only a date and an amount', async () => {
    await openJuly()
    await sheet('Income statement')
    fireEvent.click(screen.getByText('Record a transaction'))
    fireEvent.change(screen.getByLabelText('What happened?'), { target: { value: 'opening' } })
    fireEvent.change(screen.getByLabelText('Bank balance (R)'), { target: { value: '100000' } })
    const preview = screen.getByLabelText('What will be recorded')
    expect(within(preview).getByText('Debit · Bank').nextSibling.textContent).toBe('R 100 000,00')
    expect(within(preview).getByText('Credit · Owner equity').nextSibling.textContent).toBe('R 100 000,00')
  })

  test('a refusal from the database is shown, and the form stays open', async () => {
    ledger.postEntry.mockRejectedValue(new Error('That date is not valid'))
    await openJuly()
    await sheet('Income statement')
    fireEvent.click(screen.getByText('Record a transaction'))
    fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText(/^Amount \(R\)/), { target: { value: '10' } })
    fireEvent.click(screen.getByText('Record it'))
    expect((await screen.findByRole('alert')).textContent).toBe('That date is not valid')
    expect(screen.getByText('Record it')).toBeTruthy()
  })

  test('a transaction can be reversed after confirming, and a reversed one is marked', async () => {
    ledger.listRecordedEntries.mockResolvedValue([
      { id: 'r1', entry_date: '2026-07-20', memo: 'Reversal of Wrong supplier', source_type: 'reversal', reverses: 'm1', journal_lines: [{ debit_cents: 5000 }] },
      { id: 'm2', entry_date: '2026-07-12', memo: 'July rent', source_type: 'manual', reverses: null, journal_lines: [{ debit_cents: 200000 }, { debit_cents: 30000 }] },
      { id: 'm1', entry_date: '2026-07-05', memo: 'Wrong supplier', source_type: 'manual', reverses: null, journal_lines: [{ debit_cents: 5000 }] },
    ])
    ledger.reverseEntry.mockResolvedValue('r2')
    await openJuly()
    expect(await screen.findByText(/July rent/)).toBeTruthy()
    expect(screen.getByText(/Wrong supplier/).closest('div').textContent).toContain('Reversed')
    fireEvent.click(screen.getAllByText('Reverse')[0])
    expect(ledger.reverseEntry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Yes, reverse it'))
    await waitFor(() => expect(ledger.reverseEntry).toHaveBeenCalledWith('m2'))
  })
})
