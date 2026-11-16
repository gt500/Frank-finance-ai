import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const ledger = vi.hoisted(() => ({
  getChartAccounts: vi.fn(), getLedgerTotals: vi.fn(), listBankRules: vi.fn(), listBankPostings: vi.fn(), postBankLine: vi.fn(),
  skipBankLine: vi.fn(), saveBankRule: vi.fn(), reverseEntry: vi.fn(), postEntry: vi.fn(),
}))
const invoices = vi.hoisted(() => ({ listDocuments: vi.fn(), listPayments: vi.fn(), getSettings: vi.fn() }))
vi.mock('../../lib/ledgerApi', () => ledger)
vi.mock('../../lib/invoiceApi', async (orig) => ({ ...(await orig()), ...invoices }))

import { BankPosting } from './BankPosting'

const accounts = [
  { code: '6100', name: 'Salaries and wages', type: 'expense' }, { code: '6400', name: 'Bank charges', type: 'expense' },
  { code: '6900', name: 'Other expenses', type: 'expense' }, { code: '4000', name: 'Sales', type: 'income' }, { code: '4100', name: 'Other income', type: 'income' },
]
const statement = (over = {}) => ({
  bankName: 'FNB', periodStart: '2026-07-01', periodEnd: '2026-07-31', openingBalance: 0, closingBalance: 1000, isConfirmed: false,
  credits: [{ id: 'cr-0', date: '2026-07-10', description: 'EFT Smith', entityName: 'Smith', amount: 500 }],
  debits: [
    { id: 'db-0', date: '2026-07-03', description: 'Monthly Account Fee', entityName: 'Monthly Account Fee', amount: 120 },
    { id: 'db-1', date: '2026-07-05', description: 'POS 4411 Builders', entityName: 'Builders', amount: 300 },
  ],
  ...over,
})
let postings
const feeKey = 'debit|2026-07-03|12000|monthly account fee#1'

beforeEach(() => {
  Object.values({ ...ledger, ...invoices }).forEach((f) => f.mockReset())
  postings = []
  ledger.getChartAccounts.mockResolvedValue(accounts)
  ledger.listBankRules.mockResolvedValue([])
  ledger.listBankPostings.mockImplementation(async () => postings)
  ledger.getLedgerTotals.mockResolvedValue([])
  ledger.postBankLine.mockImplementation(async (key) => { postings = [...postings.filter((p) => p.line_key !== key), { line_key: key, entry_id: `e-${key}`, live: true }]; return `e-${key}` })
  ledger.skipBankLine.mockImplementation(async (key) => { postings = [...postings, { line_key: key, entry_id: null, live: false }] })
  ledger.saveBankRule.mockResolvedValue()
  ledger.reverseEntry.mockImplementation(async (id) => { postings = postings.map((p) => (p.entry_id === id ? { ...p, live: false } : p)) })
  invoices.listDocuments.mockResolvedValue([])
  invoices.listPayments.mockResolvedValue([])
  invoices.getSettings.mockResolvedValue({ vat_number: '4123456789' })
})

describe('posting bank lines to the books', () => {
  test('before the reconciliation is confirmed nothing is posted, and the lines wait with a suggestion', async () => {
    render(<BankPosting bankData={statement()} />)
    expect(await screen.findByLabelText('Category for Monthly Account Fee')).toBeTruthy()
    expect((screen.getByLabelText('Category for Monthly Account Fee')).value).toBe('6400')
    expect(screen.getByLabelText('Category for POS 4411 Builders').value).toBe('')
    expect(screen.getByLabelText('Bank lines summary').textContent).toMatch(/0 posted · 3 waiting for you/)
    expect(ledger.postBankLine).not.toHaveBeenCalled()
  })

  test('once confirmed, the line it is sure about is posted automatically, exactly once', async () => {
    const { rerender } = render(<BankPosting bankData={statement({ isConfirmed: true })} />)
    await waitFor(() => expect(ledger.postBankLine).toHaveBeenCalledTimes(1))
    const [key, entry] = ledger.postBankLine.mock.calls[0]
    expect(key).toBe(feeKey)
    expect(entry).toEqual({ date: '2026-07-03', memo: 'Bank: Monthly Account Fee', lines: [{ account: '6400', debit: 12000, credit: 0 }, { account: '1000', debit: 0, credit: 12000 }] })
    expect(await screen.findByText(/Zeeder posted 1 line it was sure about/)).toBeTruthy()
    rerender(<BankPosting bankData={statement({ isConfirmed: true })} />)
    await screen.findByText(/1 posted · 2 waiting/)
    expect(ledger.postBankLine).toHaveBeenCalledTimes(1)
  })

  test('money in and unrecognised lines are never posted without the client', async () => {
    render(<BankPosting bankData={statement({ isConfirmed: true })} />)
    await screen.findByText(/Zeeder posted 1 line/)
    expect(ledger.postBankLine.mock.calls.map((c) => c[0])).toEqual([feeKey])
  })

  test('the client picks a category, posts it, and Zeeder remembers the name for next time', async () => {
    render(<BankPosting bankData={statement()} />)
    const select = await screen.findByLabelText('Category for POS 4411 Builders')
    fireEvent.change(select, { target: { value: '6900' } })
    fireEvent.click(within(select.closest('.glass')).getByText('Post to my books'))
    await waitFor(() => expect(ledger.postBankLine).toHaveBeenCalledTimes(1))
    expect(ledger.postBankLine.mock.calls[0][1].lines).toEqual([{ account: '6900', debit: 30000, credit: 0 }, { account: '1000', debit: 0, credit: 30000 }])
    expect(ledger.saveBankRule).toHaveBeenCalledWith('builders', '6900', false)
    expect(await screen.findByText('Posted to your books.')).toBeTruthy()
  })

  test('VAT is only offered to VAT-registered clients', async () => {
    invoices.getSettings.mockResolvedValue({ vat_number: '' })
    render(<BankPosting bankData={statement()} />)
    fireEvent.change(await screen.findByLabelText('Category for POS 4411 Builders'), { target: { value: '6900' } })
    expect(screen.queryByLabelText('Includes 15% VAT')).toBeNull()
  })

  test('a line can be set aside, and then is not asked about again', async () => {
    render(<BankPosting bankData={statement()} />)
    const row = (await screen.findByLabelText('Category for POS 4411 Builders')).closest('.glass')
    fireEvent.click(within(row).getByText('Not business / set aside'))
    await waitFor(() => expect(ledger.skipBankLine).toHaveBeenCalledTimes(1))
    await screen.findByText(/2 waiting for you · 1 set aside/)
    expect(ledger.postBankLine).not.toHaveBeenCalled()
  })

  test('a wrong posting is reversed and comes back for a new choice, and is not posted again by itself', async () => {
    postings = [{ line_key: feeKey, entry_id: 'e1', live: true }]
    render(<BankPosting bankData={statement({ isConfirmed: true })} />)
    await screen.findByText(/1 posted/)
    fireEvent.click(screen.getByText('Posted lines (1)'))
    fireEvent.click(screen.getByText('Wrong? Reverse it'))
    await waitFor(() => expect(ledger.reverseEntry).toHaveBeenCalledWith('e1'))
    expect(await screen.findByText(/You reversed this line/)).toBeTruthy()
    await new Promise((r) => setTimeout(r, 30))
    expect(ledger.postBankLine).not.toHaveBeenCalled()
  })

  test('a credit already applied to an invoice is not offered again', async () => {
    invoices.listPayments.mockResolvedValue([{ reference: 'Bank cr-0|2026-07-10|500 EFT Smith' }])
    render(<BankPosting bankData={statement()} />)
    await screen.findByLabelText('Category for Monthly Account Fee')
    expect(screen.queryByLabelText('Category for EFT Smith')).toBeNull()
    expect(screen.getByLabelText('Bank lines summary').textContent).toMatch(/1 recorded as invoice payments/)
  })

  test('a failure is shown and the other lines still go through', async () => {
    ledger.postBankLine.mockRejectedValueOnce(new Error('That date is not valid'))
    render(<BankPosting bankData={statement({ isConfirmed: true, debits: [
      { id: 'db-0', date: '2026-07-03', description: 'Monthly Account Fee', entityName: 'Fee', amount: 120 },
      { id: 'db-1', date: '2026-07-04', description: 'Payroll run', entityName: 'Payroll', amount: 9000 }] })} />)
    expect(await screen.findByText(/1 could not be posted: That date is not valid/)).toBeTruthy()
    expect(ledger.postBankLine).toHaveBeenCalledTimes(2)
  })
})

describe('does the bank balance agree', () => {
  const bank = (od, oc, pd, pc) => [{ account_code: '1000', opening_debit: od, opening_credit: oc, period_debit: pd, period_credit: pc }]

  test('says so when the books and the statement agree', async () => {
    ledger.getLedgerTotals.mockResolvedValue(bank(0, 0, 100000, 0))
    render(<BankPosting bankData={statement()} />)
    expect(await screen.findByText('They agree.')).toBeTruthy()
  })

  test('shows the difference when they do not', async () => {
    ledger.getLedgerTotals.mockResolvedValue(bank(50000, 0, 100000, 0))
    render(<BankPosting bankData={statement()} />)
    expect(await screen.findByText(/Difference/)).toBeTruthy()
  })

  test('offers to record the opening balance when the books have nothing before the statement', async () => {
    ledger.postEntry.mockResolvedValue('e')
    render(<BankPosting bankData={statement({ openingBalance: 2500 })} />)
    fireEvent.click(await screen.findByText(/Record opening balance of/))
    await waitFor(() => expect(ledger.postEntry).toHaveBeenCalledTimes(1))
    expect(ledger.postEntry.mock.calls[0][0]).toEqual({ date: '2026-06-30', memo: 'Opening bank balance', lines: [{ account: '1000', debit: 250000, credit: 0 }, { account: '3000', debit: 0, credit: 250000 }] })
  })
})
