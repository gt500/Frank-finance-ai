import { describe, test, expect } from 'vitest'
import { buildMonthlyEntry, mergeMonthly, removeMonthly, safetyBuffer } from './monthlyHistory.js'

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

describe('safetyBuffer — one week of average spending', () => {
  test('averages expenses over months that have data and rounds to the nearest R 1 000', () => {
    const months = [{ rev: 0, exp: 0 }, { rev: 210000, exp: 216500 }, { rev: 220000, exp: 216500 }]
    expect(safetyBuffer(months)).toBe(50000)
  })

  test('is 0 when there is no data yet', () => {
    expect(safetyBuffer([{ rev: 0, exp: 0 }])).toBe(0)
    expect(safetyBuffer([])).toBe(0)
  })
})
