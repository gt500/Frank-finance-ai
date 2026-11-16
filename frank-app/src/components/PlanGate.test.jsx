import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

let current
vi.mock('../context/TenantContext', () => ({ useTenant: () => current }))
const startUpgrade = vi.fn()
vi.mock('../lib/upgrade', () => ({ startUpgrade: (...a) => startUpgrade(...a) }))

import { LockedFeature, usePlanAccess } from './PlanGate'

function Probe() { const { can } = usePlanAccess(); return <p>{can('invoicing') ? 'yes' : 'no'}</p> }

describe('pack gating', () => {
  beforeEach(() => { current = { plan: 'starter', subscription: null, currentUser: { name: 'Jane Smith' } }; startUpgrade.mockReset() })

  test('starter cannot use invoicing, growth can', () => {
    const { unmount } = render(<Probe />)
    expect(screen.getByText('no')).toBeTruthy()
    unmount()
    current = { plan: 'growth' }
    render(<Probe />)
    expect(screen.getByText('yes')).toBeTruthy()
  })

  test('a locked screen names the pack that unlocks it and starts that pack checkout', async () => {
    startUpgrade.mockResolvedValue({ ok: true })
    render(<LockedFeature feature="invoicing" label="Invoices & Quotes" />)
    expect(screen.getByText(/part of the Growth pack/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Growth' }))
    await waitFor(() => expect(startUpgrade).toHaveBeenCalledWith({ planId: 'growth', user: { name: 'Jane Smith' } }))
  })

  test('full statements point to Pro, and an existing subscriber is told how to change pack', () => {
    current = { plan: 'growth', subscription: { plan: 'growth' }, currentUser: null }
    render(<LockedFeature feature="fullStatements" label="Financial Statements" />)
    expect(screen.getByText(/part of the Pro pack/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull()
    expect(screen.getByRole('link', { name: /@zeeder\.ai/ })).toBeTruthy()
  })

  test('a failed checkout is reported, not swallowed', async () => {
    startUpgrade.mockResolvedValue({ ok: false, error: 'boom' })
    render(<LockedFeature feature="invoicing" label="Invoices & Quotes" />)
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Growth' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/boom/)
  })
})
