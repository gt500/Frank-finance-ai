import { describe, test, expect } from 'vitest'
import { notifyTransition, NOTIFIABLE_STATUSES, addOneMonth } from './billing.js'

describe('notifyTransition — PayHost TransactionStatus → subscription status', () => {
  test('1 (approved) activates', () => {
    expect(notifyTransition('1')).toBe('active')
  })

  test('declined / cancelled / user-cancelled / voided are terminal failures', () => {
    for (const s of ['2', '3', '4', '7']) expect(notifyTransition(s)).toBe('failed')
  })

  test('not-done, received, missing or unknown statuses change nothing', () => {
    for (const s of ['0', '5', null, undefined, '', 'garbage']) expect(notifyTransition(s)).toBeNull()
  })
})

describe('NOTIFIABLE_STATUSES — which rows a PayGate notify may touch', () => {
  test('pending and superseded attempts can still be settled', () => {
    expect(NOTIFIABLE_STATUSES).toEqual(['pending', 'superseded'])
  })

  test('a user-cancelled, active, failed or downgraded row can never be reactivated by a notify', () => {
    for (const s of ['cancelled', 'active', 'failed', 'downgraded']) expect(NOTIFIABLE_STATUSES).not.toContain(s)
  })
})

describe('addOneMonth', () => {
  test('returns a new date one month later without mutating the input', () => {
    const from = new Date('2026-11-14T10:00:00Z')
    const next = addOneMonth(from)
    expect(next.toISOString()).toBe('2026-12-14T10:00:00.000Z')
    expect(from.toISOString()).toBe('2026-11-14T10:00:00.000Z')
  })
})
