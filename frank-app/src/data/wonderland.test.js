import { describe, test, expect } from 'vitest'
import { MONTHLY, WEEKLY_FORECAST, EXPENSES, CREDITORS, DEBTORS, CASHFLOW_FLAGS, HEALTH_CHECKS } from './wonderland.js'

describe('MONTHLY — 12-month P&L data', () => {
  test('contains exactly 12 months', () => {
    expect(MONTHLY).toHaveLength(12)
  })

  test('every month has required fields', () => {
    MONTHLY.forEach(m => {
      expect(m).toHaveProperty('m')
      expect(m).toHaveProperty('fees')
      expect(m).toHaveProperty('subsidy')
      expect(m).toHaveProperty('rev')
      expect(m).toHaveProperty('exp')
      expect(m).toHaveProperty('net')
      expect(m).toHaveProperty('cash')
    })
  })

  test('revenue equals fees plus subsidy each month', () => {
    MONTHLY.forEach(m => {
      expect(m.rev).toBe(m.fees + m.subsidy)
    })
  })

  test('net profit equals revenue minus expenses each month', () => {
    MONTHLY.forEach(m => {
      expect(m.net).toBe(m.rev - m.exp)
    })
  })

  test('June (latest month) has expected cash balance', () => {
    const jun = MONTHLY[MONTHLY.length - 1]
    expect(jun.m).toBe('Jun')
    expect(jun.cash).toBe(61400)
  })
})

describe('WEEKLY_FORECAST — 13-week cash flow', () => {
  test('contains exactly 13 weeks', () => {
    expect(WEEKLY_FORECAST).toHaveLength(13)
  })

  test('every week has required fields', () => {
    WEEKLY_FORECAST.forEach(w => {
      expect(w).toHaveProperty('wk')
      expect(w).toHaveProperty('inflow')
      expect(w).toHaveProperty('outflow')
      expect(w).toHaveProperty('balance')
      expect(w).toHaveProperty('salary')
      expect(w).toHaveProperty('subsidy')
    })
  })

  test('all balances are positive', () => {
    WEEKLY_FORECAST.forEach(w => {
      expect(w.balance).toBeGreaterThan(0)
    })
  })
})

describe('EXPENSES — monthly expense breakdown', () => {
  test('percentages add up to 100', () => {
    const total = EXPENSES.reduce((s, e) => s + e.pct, 0)
    expect(total).toBe(100)
  })

  test('staff salaries are the largest expense', () => {
    const staff = EXPENSES.find(e => e.name.toLowerCase().includes('staff'))
    const others = EXPENSES.filter(e => e !== staff)
    others.forEach(e => {
      expect(staff.value).toBeGreaterThan(e.value)
    })
  })
})

describe('CREDITORS — supplier bills', () => {
  test('total owed matches sum of individual bills', () => {
    const total = CREDITORS.reduce((s, c) => s + c.amount, 0)
    expect(total).toBe(147200)
  })

  test('every creditor has a due date and amount', () => {
    CREDITORS.forEach(c => {
      expect(c.amount).toBeGreaterThan(0)
      expect(c.due).toBeTruthy()
    })
  })
})

describe('DEBTORS — outstanding fees', () => {
  test('total outstanding matches sum of individual amounts', () => {
    const total = DEBTORS.reduce((s, d) => s + d.amount, 0)
    expect(total).toBe(27800)
  })

  test('high-risk debtors are over 60 days overdue', () => {
    DEBTORS.filter(d => d.risk === 'high').forEach(d => {
      expect(d.daysOverdue).toBeGreaterThan(60)
    })
  })
})

describe('HEALTH_CHECKS — business health scores', () => {
  test('contains exactly 6 checks', () => {
    expect(HEALTH_CHECKS).toHaveLength(6)
  })

  test('all scores are between 0 and 100', () => {
    HEALTH_CHECKS.forEach(h => {
      expect(h.score).toBeGreaterThanOrEqual(0)
      expect(h.score).toBeLessThanOrEqual(100)
    })
  })

  test('overall average score is between 60 and 75', () => {
    const avg = Math.round(HEALTH_CHECKS.reduce((a, h) => a + h.score, 0) / HEALTH_CHECKS.length)
    expect(avg).toBeGreaterThanOrEqual(60)
    expect(avg).toBeLessThanOrEqual(75)
  })

  test('every check has a message and an action', () => {
    HEALTH_CHECKS.forEach(h => {
      expect(h.message).toBeTruthy()
      expect(h.action).toBeTruthy()
    })
  })
})

describe('CASHFLOW_FLAGS — risk alerts', () => {
  test('contains at least 3 flags', () => {
    expect(CASHFLOW_FLAGS.length).toBeGreaterThanOrEqual(3)
  })

  test('all HIGH severity flags have a nextDate and action', () => {
    CASHFLOW_FLAGS.filter(f => f.severity === 'HIGH').forEach(f => {
      expect(f.nextDate).toBeTruthy()
      expect(f.action).toBeTruthy()
    })
  })
})
