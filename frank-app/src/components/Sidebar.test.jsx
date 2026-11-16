import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TENANTS } from '../data/tenants'

let current
vi.mock('../context/TenantContext', () => ({ useTenant: () => current }))
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

import { Sidebar } from './Sidebar'

const workspace = (tenant, extra = {}) => ({
  tenant, data: tenant.data, bankData: null, currentUser: { id: 'u1', email: 'a@b.co', trialDaysLeft: 9 },
  logout: vi.fn(), deleteAccount: vi.fn(), canDeleteAccount: false, subscription: null, cancelSubscription: vi.fn(), ...extra,
})
const show = () => render(<Sidebar view="dashboard" onNav={vi.fn()} onAsk={vi.fn()} />)

describe('plan line in the sidebar', () => {
  beforeEach(() => { current = undefined })

  test('the demo workspace is a demo, not an expired trial, and has nothing to upgrade', () => {
    current = workspace(TENANTS.find((t) => t.id === 'cape-fresh-grocery'), { currentUser: { id: 'u1', email: 'a@b.co', trialDaysLeft: 0 } })
    show()
    expect(screen.getByText('Demo workspace')).toBeTruthy()
    expect(screen.queryByText(/days left/)).toBeNull()
    expect(screen.queryByText('Upgrade →')).toBeNull()
  })

  test('a real workspace on trial still shows the days left and the upgrade button', () => {
    current = workspace({ ...TENANTS.find((t) => t.id === 'cape-fresh-grocery'), demo: false, id: 'tenant-1', plan: 'Growth' })
    show()
    expect(screen.getByText('Trial — 9 days left')).toBeTruthy()
    expect(screen.getByText('Upgrade →')).toBeTruthy()
  })

  test('a subscriber sees their plan', () => {
    current = workspace({ ...TENANTS.find((t) => t.id === 'cape-fresh-grocery'), demo: false, id: 'tenant-1' }, { subscription: { plan: 'Growth', amount_cents: 99900 } })
    show()
    expect(screen.getByText(/Growth Plan · R 999\/mo/)).toBeTruthy()
    expect(screen.getByText('Cancel subscription')).toBeTruthy()
  })
})
