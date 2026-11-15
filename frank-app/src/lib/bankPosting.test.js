import { describe, test, expect, vi } from 'vitest'
vi.mock('./supabaseClient', () => ({ supabase: {} }))
import { accountChoices, bankEntry, classifyLine, keyedLines, normalise } from './bankPosting'
import { entryBalanced } from './ledgerEntries'

const debit = (description, amount = 100, extra = {}) => ({ type: 'debit', tx: { id: 'db-1', date: '2026-07-03', description, entityName: description, amount, ...extra }, cents: Math.round(amount * 100) })
const credit = (description, amount = 100) => ({ type: 'credit', tx: { id: 'cr-1', date: '2026-07-03', description, entityName: description, amount }, cents: Math.round(amount * 100) })
const asLine = (l) => ({ ...l.tx, type: l.type, entityName: l.tx.entityName })

describe('keys that identify a bank line across statements', () => {
  const data = (credits, debits) => ({ credits, debits })
  const tx = (id, date, description, amount) => ({ id, date, description, amount })

  test('the same line on an overlapping statement gets the same key, whatever its position', () => {
    const a = keyedLines(data([], [tx('db-0', '2026-07-03', 'Monthly Account Fee', 120), tx('db-1', '2026-07-04', 'Engen  Bellville', 800)]))
    const b = keyedLines(data([], [tx('db-7', '2026-07-04', 'ENGEN Bellville', 800)]))
    expect(b[0].key).toBe(a[1].key)
  })

  test('two identical lines on one day are told apart', () => {
    const k = keyedLines(data([], [tx('db-0', '2026-07-03', 'Coffee', 45), tx('db-1', '2026-07-03', 'Coffee', 45)]))
    expect(k.map((x) => x.key.split('#')[1])).toEqual(['1', '2'])
    expect(new Set(k.map((x) => x.key)).size).toBe(2)
  })

  test('money in and money out never share a key, and amounts are whole cents', () => {
    const k = keyedLines(data([tx('cr-0', '2026-07-03', 'X', 10.1)], [tx('db-0', '2026-07-03', 'X', 10.1)]))
    expect(k[0].key).not.toBe(k[1].key)
    expect(k[0].cents).toBe(1010)
  })

  test('slash dates are read as the same day as ISO dates', () => {
    const a = keyedLines(data([], [tx('db-0', '2026/07/03', 'Fee', 5)]))
    const b = keyedLines(data([], [tx('db-1', '2026-07-03', 'Fee', 5)]))
    expect(a[0].key).toBe(b[0].key)
  })
})

describe('what Zeeder is sure about, and what it only suggests', () => {
  test('bank fees, interest charged and salaries are posted without asking', () => {
    for (const [text, account] of [['Monthly Account Fee', '6400'], ['SERVICE FEE', '6400'], ['Cash Deposit Fee', '6400'], ['Interest charged', '6400'], ['Salaries June', '6100'], ['Payroll run', '6100']]) {
      expect(classifyLine(asLine(debit(text)), { vatRegistered: true })).toMatchObject({ account, vat: false, confidence: 'high' })
    }
  })

  test('a supplier fee is not mistaken for a bank fee', () => {
    expect(classifyLine(asLine(debit('Legal fee Smith and Co')), {}).confidence).not.toBe('high')
  })

  test('likely categories are only suggestions, with VAT only for VAT-registered clients', () => {
    expect(classifyLine(asLine(debit('ENGEN Bellville')), { vatRegistered: true })).toMatchObject({ account: '6800', vat: true, confidence: 'low' })
    expect(classifyLine(asLine(debit('ENGEN Bellville')), { vatRegistered: false })).toMatchObject({ account: '6800', vat: false, confidence: 'low' })
    expect(classifyLine(asLine(debit('Rent July')), {}).account).toBe('6200')
  })

  test('something unrecognised is left for the client to choose', () => {
    expect(classifyLine(asLine(debit('POS PURCHASE 4411')), {})).toMatchObject({ account: '', confidence: 'none' })
  })

  test('a name the client taught Zeeder is trusted, with the VAT choice they made', () => {
    const rules = [{ match: 'abc stationers', account: '6900', vat: true }]
    expect(classifyLine(asLine(debit('ABC  Stationers Bellville')), { rules, vatRegistered: true })).toMatchObject({ account: '6900', vat: true, confidence: 'high' })
    expect(classifyLine(asLine(debit('ABC Stationers')), { rules, vatRegistered: false }).vat).toBe(false)
  })

  test('a learned rule beats the built-in guess', () => {
    const rules = [{ match: 'engen', account: '5000', vat: false }]
    expect(classifyLine(asLine(debit('Engen Bellville')), { rules })).toMatchObject({ account: '5000', confidence: 'high' })
  })

  test('money in is only ever a suggestion, except interest received', () => {
    expect(classifyLine(asLine(credit('EFT Durbanville Catering')), { vatRegistered: true })).toMatchObject({ account: '4000', vat: true, confidence: 'low' })
    expect(classifyLine(asLine(credit('Interest received')), {})).toMatchObject({ account: '4100', confidence: 'high' })
  })

  test('normalise ignores case, punctuation and spacing', () => {
    expect(normalise('  ENGEN-Bellville, 0412 ')).toBe('engen bellville 0412')
  })
})

describe('the entries built from a line', () => {
  test('money out with VAT: expense and VAT input against the bank', () => {
    const e = bankEntry(debit('Engen', 1150), { account: '6800', vat: true })
    expect(e.date).toBe('2026-07-03')
    expect(e.memo).toBe('Bank: Engen')
    expect(e.lines).toEqual([{ account: '6800', debit: 100000, credit: 0 }, { account: '2210', debit: 15000, credit: 0 }, { account: '1000', debit: 0, credit: 115000 }])
  })

  test('money out without VAT is one expense line against the bank', () => {
    expect(bankEntry(debit('Fee', 120), { account: '6400', vat: false }).lines).toEqual([{ account: '6400', debit: 12000, credit: 0 }, { account: '1000', debit: 0, credit: 12000 }])
  })

  test('paying a supplier already recorded reduces creditors; owner drawings reduce equity', () => {
    expect(bankEntry(debit('Supplier', 500), { account: '2000', vat: true }).lines.map((l) => l.account)).toEqual(['2000', '1000'])
    expect(bankEntry(debit('Me', 500), { account: '3000', vat: true }).lines.map((l) => l.account)).toEqual(['3000', '1000'])
  })

  test('money in with VAT splits sales from VAT output; without VAT it is one line', () => {
    expect(bankEntry(credit('Customer', 1150), { account: '4000', vat: true }).lines).toEqual([
      { account: '1000', debit: 115000, credit: 0 }, { account: '4000', debit: 0, credit: 100000 }, { account: '2200', debit: 0, credit: 15000 }])
    expect(bankEntry(credit('Interest', 10), { account: '4100', vat: false }).lines).toHaveLength(2)
  })

  test('owner money in is equity, never taxed', () => {
    expect(bankEntry(credit('Me', 5000), { account: '3000', vat: true }).lines).toEqual([{ account: '1000', debit: 500000, credit: 0 }, { account: '3000', debit: 0, credit: 500000 }])
  })

  test('every entry it builds is balanced', () => {
    for (const [line, choice] of [[debit('a', 33.33), { account: '6900', vat: true }], [credit('b', 77.77), { account: '4000', vat: true }], [debit('c', 1), { account: '2000' }]]) {
      expect(entryBalanced(bankEntry(line, choice))).toBe(true)
    }
  })

  test('refuses a missing category or a bad date, in plain words', () => {
    expect(() => bankEntry(debit('x'), { account: '', vat: false })).toThrow(/Choose what/)
    expect(() => bankEntry(debit('x', 10, { date: 'soon' }), { account: '6900' })).toThrow(/valid date/)
  })

  test('a long description is cut to the length the database accepts', () => {
    expect(bankEntry(debit('x'.repeat(400)), { account: '6900' }).memo.length).toBeLessThanOrEqual(200)
  })
})

describe('categories offered', () => {
  const accounts = [{ code: '6400', name: 'Bank charges', type: 'expense' }, { code: '6950', name: 'Depreciation', type: 'expense' }, { code: '4000', name: 'Sales', type: 'income' }, { code: '4100', name: 'Other income', type: 'income' }]
  test('money out offers expenses (not depreciation) plus supplier and owner choices', () => {
    const codes = accountChoices('debit', accounts).map(([c]) => c)
    expect(codes).toEqual(['6400', '2000', '3000'])
  })
  test('money in offers sales, other income and owner money', () => {
    expect(accountChoices('credit', accounts).map(([c]) => c)).toEqual(['4000', '4100', '3000'])
  })
})
