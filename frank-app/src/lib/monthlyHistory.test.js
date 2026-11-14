import { describe, test, expect } from 'vitest'
import { buildMonthlyEntry, mergeMonthly, removeMonthly } from './monthlyHistory.js'

const statement = (periodEnd) => ({
  bankName: 'Absa', periodStart: '', periodEnd, closingBalance: 1000,
  credits: [{ amount: 500 }], debits: [{ amount: 200 }],
})

describe('removeMonthly — clearing a confirmed bank statement', () => {
  test('removes only the month that statement produced, keeping other months', () => {
    const history = mergeMonthly(mergeMonthly([], buildMonthlyEntry(statement('2026-09-30'))), buildMonthlyEntry(statement('2026-10-31')))
    const next = removeMonthly(history, statement('2026-10-31'))
    expect(next.map(h => h.m)).toEqual([buildMonthlyEntry(statement('2026-09-30')).m])
  })

  test('returns null when nothing is left, so the tenant default month shows again', () => {
    const history = mergeMonthly([], buildMonthlyEntry(statement('2026-10-31')))
    expect(removeMonthly(history, statement('2026-10-31'))).toBeNull()
  })

  test('does not mutate the input history', () => {
    const history = mergeMonthly([], buildMonthlyEntry(statement('2026-10-31')))
    removeMonthly(history, statement('2026-10-31'))
    expect(history).toHaveLength(1)
  })

  test('handles a missing history', () => {
    expect(removeMonthly(null, statement('2026-10-31'))).toBeNull()
  })
})
