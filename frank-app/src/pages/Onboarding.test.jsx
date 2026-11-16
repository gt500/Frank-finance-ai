import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Onboarding } from './Onboarding'

async function toPackStep(onComplete, initialPlan) {
  render(<Onboarding onComplete={onComplete} onBack={vi.fn()} initialPlan={initialPlan} />)
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Smith' } })
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'jane@shop.co.za' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret-pass' } })
  fireEvent.click(screen.getByText('Continue →'))
  fireEvent.change(await screen.findByLabelText('Business name'), { target: { value: 'Shop (Pty) Ltd' } })
  fireEvent.change(screen.getByLabelText('Industry / Sector'), { target: { value: 'Retail' } })
  fireEvent.change(screen.getByLabelText('City / Location'), { target: { value: 'Cape Town' } })
  fireEvent.click(screen.getByText('Continue →'))
  await screen.findByRole('radiogroup', { name: 'Choose a pack' })
}

describe('sign-up', () => {
  test('offers the three packs and preselects the one chosen on the landing page', async () => {
    await toPackStep(vi.fn(), 'pro')
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /^Pro/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /^Starter/ }).getAttribute('aria-checked')).toBe('false')
  })

  test('cannot create the account until the person agrees to the terms and privacy notice', async () => {
    const onComplete = vi.fn().mockResolvedValue({ ok: true })
    await toPackStep(onComplete)
    fireEvent.click(screen.getByText('Create my account →'))
    const enter = await screen.findByText('Enter my dashboard →')
    expect(enter.disabled).toBe(true)
    fireEvent.click(enter)
    expect(onComplete).not.toHaveBeenCalled()

    expect(screen.getByRole('link', { name: 'terms of use' }).getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: 'privacy notice' }).getAttribute('href')).toBe('/privacy')
    fireEvent.click(screen.getByRole('checkbox'))
    expect(enter.disabled).toBe(false)
    fireEvent.click(enter)
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ consent: true, plan: 'growth' })))
  })

  test('a problem with a field is announced and tied to it', async () => {
    render(<Onboarding onComplete={vi.fn()} onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Continue →'))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Full name').getAttribute('aria-invalid')).toBe('true')
  })
})
