import { describe, test, expect } from 'vitest'
import { periodRange, PERIOD_KINDS } from './periods'

const r = (kind, today, custom) => periodRange(kind, today, custom)

describe('reporting periods and the period they are compared with', () => {
  test('this month compares with the previous month', () => {
    expect(r('month', '2026-07-15')).toMatchObject({ from: '2026-07-01', to: '2026-07-31', priorFrom: '2026-06-01', priorTo: '2026-06-30' })
  })
  test('February has 28 or 29 days', () => {
    expect(r('month', '2028-02-10')).toMatchObject({ from: '2028-02-01', to: '2028-02-29', priorFrom: '2028-01-01', priorTo: '2028-01-31' })
    expect(r('month', '2027-03-10')).toMatchObject({ from: '2027-03-01', to: '2027-03-31', priorFrom: '2027-02-01', priorTo: '2027-02-28' })
  })
  test('last month steps back across a year end', () => {
    expect(r('lastMonth', '2027-01-09')).toMatchObject({ from: '2026-12-01', to: '2026-12-31', priorFrom: '2026-11-01', priorTo: '2026-11-30' })
  })
  test('this quarter compares with the previous quarter', () => {
    expect(r('quarter', '2026-08-20')).toMatchObject({ from: '2026-07-01', to: '2026-09-30', priorFrom: '2026-04-01', priorTo: '2026-06-30' })
    expect(r('quarter', '2026-02-02')).toMatchObject({ from: '2026-01-01', to: '2026-03-31', priorFrom: '2025-10-01', priorTo: '2025-12-31' })
  })
  test('year to date compares with the same dates last year', () => {
    expect(r('ytd', '2026-11-15')).toMatchObject({ from: '2026-01-01', to: '2026-11-15', priorFrom: '2025-01-01', priorTo: '2025-11-15' })
  })
  test('a custom range compares with the same number of days just before it', () => {
    expect(r('custom', '2026-11-15', { from: '2026-07-10', to: '2026-07-19' })).toMatchObject({ from: '2026-07-10', to: '2026-07-19', priorFrom: '2026-06-30', priorTo: '2026-07-09' })
  })
  test('a custom range with the end before the start is not accepted', () => {
    expect(() => r('custom', '2026-11-15', { from: '2026-07-19', to: '2026-07-10' })).toThrow(/before/)
    expect(() => r('custom', '2026-11-15', { from: 'x', to: '2026-07-10' })).toThrow()
  })
  test('every period has a plain label', () => {
    expect(r('month', '2026-07-15').label).toBe('July 2026')
    expect(r('quarter', '2026-08-20').label).toBe('July to September 2026')
    expect(r('ytd', '2026-11-15').label).toBe('1 January to 15 November 2026')
    expect(r('month', '2026-07-15').priorLabel).toBe('June 2026')
    expect(r('quarter', '2026-08-20').priorLabel).toBe('April to June 2026')
    expect(r('ytd', '2026-11-15').priorLabel).toBe('1 January to 15 November 2025')
    expect(r('custom', '2026-11-15', { from: '2026-07-10', to: '2026-07-19' }).priorLabel).toBe('30 June 2026 to 9 July 2026')
    expect(PERIOD_KINDS.map((k) => k.id)).toEqual(['month', 'lastMonth', 'quarter', 'ytd', 'custom'])
  })
})
