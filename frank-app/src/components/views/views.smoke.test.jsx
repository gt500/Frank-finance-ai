import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TENANTS } from '../../data/tenants'

// Render every redesigned screen with the real demo data, and with an empty brand-new workspace.
let current
vi.mock('../../context/TenantContext', () => ({ useTenant: () => current }))
// Connections now shows the mailbox settings; keep this test off the network.
vi.mock('../../lib/invoiceApi', async (orig) => ({ ...(await orig()), getSettings: async () => null, getMailbox: async () => null }))

import { Dashboard } from './Dashboard'
import { CashFlow } from './CashFlow'
import { Reports } from './Reports'
import { Health } from './Health'
import { Connections } from './Connections'

const workspace = (id) => {
  const tenant = TENANTS.find((t) => t.id === id)
  return { tenant, data: tenant.data, bankData: null, currentUser: { id: 'u1', email: 'a@b.co' }, systemPrompt: '' }
}
const props = { onAsk: vi.fn(), liveData: null, loading: false }

describe('Cape Fresh (12 months of data)', () => {
  beforeEach(() => { current = workspace('cape-fresh-grocery') })

  test('Dashboard shows figures on every bar and names the selected month', () => {
    render(<Dashboard {...props} />)
    expect(screen.getByText('Revenue vs expenses')).toBeTruthy()
    expect(screen.getAllByText(/Net profit R 6 000/).length).toBeGreaterThan(0)   // June: R 6 000
    expect(screen.getAllByText('R 218 000').length).toBeGreaterThan(0)            // June revenue on its bar
    // the month strip defaults to the latest month with data
    expect(screen.getAllByText('Jun').length).toBeGreaterThan(0)
  })

  test('choosing a month in the dropdown updates the detail strip', () => {
    render(<Dashboard {...props} />)
    const select = screen.getByLabelText('Month')
    fireEvent.change(select, { target: { value: select.querySelectorAll('option')[5].value } })   // December
    expect(screen.getAllByText(/December/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R 42 000/).length).toBeGreaterThan(0)
  })

  test('forecast labels weeks with date ranges', () => {
    render(<Dashboard {...props} />)
    expect(screen.getAllByText('Week 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Jul W1').length).toBeGreaterThan(0)
  })

  test('CashFlow renders weekly in/out and balance charts', () => {
    render(<CashFlow onAsk={vi.fn()} />)
    expect(screen.getByText('Money in vs money out — weekly')).toBeTruthy()
    expect(screen.getByText('Projected balance')).toBeTruthy()
  })

  test('Reports and Health render', () => {
    render(<Reports onAsk={vi.fn()} />)
    expect(screen.getByText('Profit Trend — 12 Months')).toBeTruthy()
    render(<Health onAsk={vi.fn()} />)
    expect(screen.getAllByText('out of 100').length).toBeGreaterThan(0)
  })
})

describe('Brand-new empty workspace (Wonderland: all zeros, no forecast)', () => {
  beforeEach(() => { current = workspace('wonderland-educare') })

  test('Dashboard does not crash and invites a bank statement upload', () => {
    render(<Dashboard {...props} />)
    expect(screen.getByText(/No months with data yet/)).toBeTruthy()
    expect(screen.getByText(/Upload two or more months of bank statements/)).toBeTruthy()
  })

  test('CashFlow does not crash', () => {
    render(<CashFlow onAsk={vi.fn()} />)
    expect(screen.getByText('Upcoming cash events')).toBeTruthy()
  })

  test('Reports and Health do not crash', () => {
    expect(() => render(<Reports onAsk={vi.fn()} />)).not.toThrow()
    expect(() => render(<Health onAsk={vi.fn()} />)).not.toThrow()
  })
})

describe('Connections', () => {
  beforeEach(() => { current = workspace('cape-fresh-grocery') })

  test('lists all five major banks with statement upload supported and makes no live-feed promise', () => {
    const onNav = vi.fn()
    render(<Connections onAsk={vi.fn()} onNav={onNav} loading={false} simplePayConnected={false} />)
    for (const bank of ['FNB', 'Standard Bank', 'Nedbank', 'Absa', 'Capitec']) expect(screen.getAllByText(bank).length).toBeGreaterThan(0)
    const panel = within(screen.getByText('Your bank').closest('.glass'))
    expect(panel.getAllByText('Supported')).toHaveLength(5)
    expect(panel.queryByText('Coming soon')).toBeNull()
    expect(panel.queryByText(/live bank feed|roadmap/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Upload a statement' }))
    expect(onNav).toHaveBeenCalledWith('documents')
  })
})
