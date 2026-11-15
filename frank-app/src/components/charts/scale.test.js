import { describe, test, expect } from 'vitest'
import { niceTicks, randTick } from './scale.js'

describe('niceTicks — value axis ticks', () => {
  test('rounds the top up to a clean step and starts at 0', () => {
    expect(niceTicks(320000)).toEqual([0, 50000, 100000, 150000, 200000, 250000, 300000, 350000])
  })

  test('keeps the tick count readable for small values', () => {
    const t = niceTicks(104000)
    expect(t[0]).toBe(0)
    expect(t.at(-1)).toBeGreaterThanOrEqual(104000)
    expect(t.length).toBeLessThanOrEqual(8)
  })

  test('an all-zero dataset (new business) still gets a usable axis', () => {
    expect(niceTicks(0)).toEqual([0, 1000])
  })

  test('ignores negatives for the axis top', () => {
    expect(niceTicks(-5000)).toEqual([0, 1000])
  })
})

describe('randTick', () => {
  test('formats axis labels in rand thousands', () => {
    expect(randTick(0)).toBe('R 0')
    expect(randTick(50000)).toBe('R 50k')
    expect(randTick(2500)).toBe('R 2.5k')
    expect(randTick(1500000)).toBe('R 1.5M')
  })
})
