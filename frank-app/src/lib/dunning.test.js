import { describe, test, expect } from 'vitest'
import { nextDunningState, MAX_ATTEMPTS } from './dunning.js'

describe('nextDunningState — success', () => {
  test('resets failure count and stays active regardless of prior count', () => {
    expect(nextDunningState(0, true)).toEqual({ status: 'active', failed_charge_count: 0, retryInDays: null, downgrade: false })
    expect(nextDunningState(3, true)).toEqual({ status: 'active', failed_charge_count: 0, retryInDays: null, downgrade: false })
  })
})

describe('nextDunningState — failure progression', () => {
  test('1st failure: retries in 3 days, stays active', () => {
    expect(nextDunningState(0, false)).toEqual({ status: 'active', failed_charge_count: 1, retryInDays: 3, downgrade: false })
  })

  test('2nd failure: retries in 3 days, stays active', () => {
    expect(nextDunningState(1, false)).toEqual({ status: 'active', failed_charge_count: 2, retryInDays: 3, downgrade: false })
  })

  test('3rd failure: retries in 3 days, stays active', () => {
    expect(nextDunningState(2, false)).toEqual({ status: 'active', failed_charge_count: 3, retryInDays: 3, downgrade: false })
  })

  test('4th consecutive failure: downgrades, no further retry', () => {
    expect(nextDunningState(3, false)).toEqual({ status: 'downgraded', failed_charge_count: 4, retryInDays: null, downgrade: true })
  })

  test('failures beyond the 4th stay downgraded', () => {
    expect(nextDunningState(4, false)).toEqual({ status: 'downgraded', failed_charge_count: 5, retryInDays: null, downgrade: true })
  })
})

test('MAX_ATTEMPTS matches the 3-retries-then-downgrade policy', () => {
  expect(MAX_ATTEMPTS).toBe(4)
})
