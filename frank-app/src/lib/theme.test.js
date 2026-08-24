import { describe, test, expect } from 'vitest'
import { fmt, fmtK, fmtM } from './theme.js'

describe('fmt — formats rands with full number', () => {
  test('formats whole number with SA locale separators', () => {
    expect(fmt(61400)).toBe('R 61 400')
  })

  test('formats zero', () => {
    expect(fmt(0)).toBe('R 0')
  })

  test('formats negative number', () => {
    expect(fmt(-10400)).toBe('R -10 400')
  })

  test('accepts string input', () => {
    expect(fmt('5000')).toBe('R 5 000')
  })
})

describe('fmtK — abbreviates to K for thousands', () => {
  test('abbreviates thousands to k', () => {
    expect(fmtK(61400)).toBe('R 61k')
  })

  test('shows full number under 1000', () => {
    expect(fmtK(999)).toBe('R 999')
  })

  test('rounds to nearest k', () => {
    expect(fmtK(1500)).toBe('R 2k')
  })
})

describe('fmtM — abbreviates to M for millions', () => {
  test('abbreviates millions to M', () => {
    expect(fmtM(1500000)).toBe('R 1.5M')
  })

  test('falls through to fmtK under 1 million', () => {
    expect(fmtM(61400)).toBe('R 61k')
  })
})
