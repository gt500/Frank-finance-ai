import { describe, test, expect } from 'vitest'
import { PLANS, PLAN_ORDER, FEATURES, planFor, allows, packWith, priceText } from './plans'

describe('packs', () => {
  test('there are three, priced R499, R999 and R1 999', () => {
    expect(PLAN_ORDER.map((id) => PLANS[id].price)).toEqual([499, 999, 1999])
  })

  test('each pack includes everything in the one below it', () => {
    expect(PLANS.growth.features).toEqual(expect.arrayContaining(PLANS.starter.features))
    expect(PLANS.pro.features).toEqual(expect.arrayContaining(PLANS.growth.features))
  })

  test('every feature a pack lists is a real feature, and AI allowances grow with the pack', () => {
    for (const p of Object.values(PLANS)) for (const f of p.features) expect(FEATURES[f]).toBeTruthy()
    expect(PLANS.starter.aiRequests).toBeLessThan(PLANS.growth.aiRequests)
    expect(PLANS.growth.aiRequests).toBeLessThan(PLANS.pro.aiRequests)
  })

  test('starter has no invoicing; growth has it but not the full statements; pro has everything', () => {
    expect(allows('starter', 'invoicing')).toBe(false)
    expect(allows('growth', 'invoicing')).toBe(true)
    expect(allows('growth', 'fullStatements')).toBe(false)
    expect(Object.keys(FEATURES).every((f) => allows('pro', f))).toBe(true)
  })

  test('packWith names the cheapest pack that unlocks a feature', () => {
    expect(packWith('invoicing').id).toBe('growth')
    expect(packWith('fullStatements').id).toBe('pro')
  })

  test('copy never promises live bank feeds', () => {
    expect(JSON.stringify(PLANS)).not.toMatch(/live bank|bank feed|bank connected/i)
  })

  test('prices read on one line', () => {
    expect(priceText(PLANS.pro)).toBe('R 1 999')
  })
})

describe('which pack a workspace is on', () => {
  test('a paid subscription wins over the sign-up choice', () => {
    expect(planFor({ tenantId: 't1', subscription: { plan: 'pro' }, chosen: 'starter' })).toBe('pro')
  })

  test('during the trial it is the pack chosen at sign-up, in any letter case', () => {
    expect(planFor({ tenantId: 't1', chosen: 'Starter' })).toBe('starter')
  })

  test('unknown or missing falls back to growth', () => {
    expect(planFor({ tenantId: 't1', chosen: 'gold' })).toBe('growth')
    expect(planFor({})).toBe('growth')
  })

  test('a workspace opened before the packs launched keeps everything until it pays', () => {
    expect(planFor({ tenantId: 't1', chosen: 'Starter', trialStart: '2026-09-28 10:00:00+00' })).toBe('pro')
    expect(planFor({ tenantId: 't1', chosen: 'Starter', trialStart: '2026-11-17 10:00:00+00' })).toBe('starter')
    expect(planFor({ tenantId: 't1', subscription: { plan: 'starter' }, trialStart: '2026-09-28' })).toBe('starter')
  })

  test('our own demo and partner workspaces see everything', () => {
    expect(planFor({ tenantId: 'cape-fresh-grocery', chosen: 'starter' })).toBe('pro')
    expect(planFor({ tenantId: 'wonderland-educare' })).toBe('pro')
  })
})
