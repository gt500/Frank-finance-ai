import { describe, test, expect } from 'vitest'
import { fmt, fmtK, fmtM } from './theme.js'

describe('fmt — formats rands with full number', () => {
  test('formats whole number with SA locale separators', () => {
    expect(fmt(61400)).toBe('R\u00A061\u00A0400')
  })

  test('formats zero', () => {
    expect(fmt(0)).toBe('R\u00A00')
  })

  test('formats negative number', () => {
    expect(fmt(-10400)).toBe('R\u00A0-10\u00A0400')
  })

  test('accepts string input', () => {
    expect(fmt('5000')).toBe('R\u00A05\u00A0000')
  })
})

describe('fmtK — abbreviates to K for thousands', () => {
  test('abbreviates thousands to k', () => {
    expect(fmtK(61400)).toBe('R\u00A061k')
  })

  test('shows full number under 1000', () => {
    expect(fmtK(999)).toBe('R\u00A0999')
  })

  test('rounds to nearest k', () => {
    expect(fmtK(1500)).toBe('R\u00A02k')
  })
})

describe('fmtM — abbreviates to M for millions', () => {
  test('abbreviates millions to M', () => {
    expect(fmtM(1500000)).toBe('R\u00A01.5M')
  })

  test('falls through to fmtK under 1 million', () => {
    expect(fmtM(61400)).toBe('R\u00A061k')
  })
})
