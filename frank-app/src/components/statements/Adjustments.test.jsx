import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const ledger = vi.hoisted(() => ({
  listFixedAssets: vi.fn(), getTaxRate: vi.fn(), addFixedAsset: vi.fn(), voidFixedAsset: vi.fn(), postDepreciation: vi.fn(), postStockCount: vi.fn(), saveTaxRate: vi.fn(),
}))
vi.mock('../../lib/ledgerApi', () => ledger)
vi.mock('../../lib/invoiceApi', async (orig) => ({ ...(await orig()), todaySA: () => '2026-07-20' }))

import { Adjustments } from './Adjustments'

let changed
beforeEach(() => {
  Object.values(ledger).forEach((f) => f.mockReset())
  ledger.listFixedAssets.mockResolvedValue([])
  ledger.getTaxRate.mockResolvedValue(null)
  ledger.addFixedAsset.mockResolvedValue('a1')
  ledger.postDepreciation.mockResolvedValue(0)
  ledger.postStockCount.mockResolvedValue('s1')
  ledger.saveTaxRate.mockResolvedValue({})
  changed = vi.fn()
})
const open = async (name) => { render(<Adjustments onChanged={changed} />); fireEvent.click(await screen.findByText(name)) }

describe('equipment', () => {
  test('records the purchase with the VAT split out, then charges depreciation for the months that have passed', async () => {
    await open(/Equipment and depreciation/)
    fireEvent.change(screen.getByLabelText('Equipment name'), { target: { value: 'Delivery van' } })
    fireEvent.change(screen.getByLabelText(/^Price \(R\)/), { target: { value: '115000' } })
    fireEvent.change(screen.getByLabelText('Date bought'), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText('Lasts (years)'), { target: { value: '5' } })
    fireEvent.click(screen.getByText('Add equipment'))
    await waitFor(() => expect(ledger.addFixedAsset).toHaveBeenCalledTimes(1))
    expect(ledger.addFixedAsset.mock.calls[0][0]).toEqual({ name: 'Delivery van', totalCents: 11500000, vatCents: 1500000, date: '2026-03-01', residualCents: 0, lifeMonths: 60, funding: 'bank' })
    await waitFor(() => expect(ledger.postDepreciation).toHaveBeenCalledWith('2026-07-20'))
    await waitFor(() => expect(changed).toHaveBeenCalled())
  })

  test('equipment owned before Zeeder has no VAT to claim', async () => {
    await open(/Equipment and depreciation/)
    fireEvent.change(screen.getByLabelText('Equipment name'), { target: { value: 'Old fridge' } })
    fireEvent.change(screen.getByLabelText(/^Price \(R\)/), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('How was it paid for?'), { target: { value: 'opening' } })
    expect(screen.queryByLabelText('The price includes 15% VAT')).toBeNull()
    fireEvent.click(screen.getByText('Add equipment'))
    await waitFor(() => expect(ledger.addFixedAsset).toHaveBeenCalled())
    expect(ledger.addFixedAsset.mock.calls[0][0]).toMatchObject({ vatCents: 0, funding: 'opening' })
  })

  test('asks for a name and a sensible life before calling the database', async () => {
    await open(/Equipment and depreciation/)
    fireEvent.click(screen.getByText('Add equipment'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/short name/)
    fireEvent.change(screen.getByLabelText('Equipment name'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Lasts (years)'), { target: { value: '0' } })
    fireEvent.click(screen.getByText('Add equipment'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/years/)
    expect(ledger.addFixedAsset).not.toHaveBeenCalled()
  })

  test('shows what is on the register and removes a mistake only after confirming', async () => {
    ledger.listFixedAssets.mockResolvedValue([{ id: 'a1', name: 'Fridge', cost_cents: 1200000, residual_cents: 0, purchase_date: '2026-01-10', life_months: 60 }])
    ledger.voidFixedAsset.mockResolvedValue()
    await open(/Equipment and depreciation \(1\)/)
    expect(screen.getByText(/depreciation/, { selector: 'span' }).textContent).toMatch(/R 200,00 a month/)
    fireEvent.click(screen.getByText('Remove (entered by mistake)'))
    expect(ledger.voidFixedAsset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Yes, remove it'))
    await waitFor(() => expect(ledger.voidFixedAsset).toHaveBeenCalledWith('a1'))
  })
})

describe('stock count', () => {
  test('sends the counted value in cents', async () => {
    await open('Stock count')
    fireEvent.change(screen.getByLabelText(/^Value of stock/), { target: { value: '45 250,50' } })
    fireEvent.click(screen.getByText('Record stock count'))
    await waitFor(() => expect(ledger.postStockCount).toHaveBeenCalledWith('2026-07-20', 4525050))
    expect(await screen.findByText('Stock count recorded.')).toBeTruthy()
  })

  test('says so when nothing needed to change', async () => {
    ledger.postStockCount.mockResolvedValue(null)
    await open('Stock count')
    fireEvent.change(screen.getByLabelText(/^Value of stock/), { target: { value: '100' } })
    fireEvent.click(screen.getByText('Record stock count'))
    expect(await screen.findByText(/No change/)).toBeTruthy()
  })

  test('cannot record an empty count', async () => {
    await open('Stock count')
    expect(screen.getByText('Record stock count').disabled).toBe(true)
  })
})

describe('income tax rate', () => {
  test('saves the rate, and the company rate is one click away', async () => {
    await open(/Income tax estimate/)
    fireEvent.click(screen.getByText('Use company rate (27%)'))
    fireEvent.click(screen.getByText('Save rate'))
    await waitFor(() => expect(ledger.saveTaxRate).toHaveBeenCalledWith(27))
    await waitFor(() => expect(changed).toHaveBeenCalled())
  })

  test('accepts a comma as the decimal and refuses more than 45', async () => {
    await open(/Income tax estimate/)
    fireEvent.change(screen.getByPlaceholderText('27'), { target: { value: '21,5' } })
    fireEvent.click(screen.getByText('Save rate'))
    await waitFor(() => expect(ledger.saveTaxRate).toHaveBeenCalledWith(21.5))
    fireEvent.change(screen.getByPlaceholderText('27'), { target: { value: '80' } })
    fireEvent.click(screen.getByText('Save rate'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/between 0 and 45/)
    expect(ledger.saveTaxRate).toHaveBeenCalledTimes(1)
  })
})
