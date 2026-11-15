import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Login } from './Login'

describe('login page', () => {
  test('has no demo account or password on it', () => {
    render(<Login onLogin={vi.fn()} onStartOnboarding={vi.fn()} />)
    expect(screen.queryByText(/demo/i)).toBeNull()
    expect(document.body.textContent).not.toMatch(/capefresh2025|admin@capefresh/)
  })

  test('fields are labelled for screen readers and password managers', () => {
    render(<Login onLogin={vi.fn()} onStartOnboarding={vi.fn()} />)
    expect(screen.getByLabelText('Email address').getAttribute('autocomplete')).toBe('username')
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('current-password')
  })

  test('signs in with the email trimmed and lower-cased', async () => {
    const onLogin = vi.fn().mockResolvedValue({ ok: true })
    render(<Login onLogin={onLogin} onStartOnboarding={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: '  Owner@Shop.CO.za ' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } })
    fireEvent.click(screen.getByText('Sign In →'))
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('owner@shop.co.za', 'secret-pass'))
  })

  test('shows a wrong-password message as an alert and lets the person try again', async () => {
    const onLogin = vi.fn().mockResolvedValue({ ok: false, error: 'Invalid login credentials' })
    render(<Login onLogin={onLogin} onStartOnboarding={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } })
    fireEvent.click(screen.getByText('Sign In →'))
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid login credentials')
    expect(screen.getByText('Sign In →').disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'y' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('new visitors can start the free trial', () => {
    const start = vi.fn()
    render(<Login onLogin={vi.fn()} onStartOnboarding={start} />)
    fireEvent.click(screen.getByText('Start your free trial →'))
    expect(start).toHaveBeenCalled()
  })

  describe('forgot password', () => {
    test('is offered only when the app can send a reset', () => {
      render(<Login onLogin={vi.fn()} onStartOnboarding={vi.fn()} />)
      expect(screen.queryByText('Forgot your password?')).toBeNull()
    })

    test('asks for the email, sends it trimmed (the app lower-cases it), and says the same thing for any address', async () => {
      const onResetRequest = vi.fn().mockResolvedValue({ ok: true })
      render(<Login onLogin={vi.fn()} onStartOnboarding={vi.fn()} onResetRequest={onResetRequest} />)
      fireEvent.click(screen.getByText('Forgot your password?'))
      fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' Owner@Shop.co.za ' } })
      fireEvent.click(screen.getByText('Send reset link'))
      await waitFor(() => expect(onResetRequest).toHaveBeenCalledWith('Owner@Shop.co.za'))
      expect((await screen.findByRole('status')).textContent).toMatch(/If there is an account for that email/)
      expect(screen.queryByText('Send reset link')).toBeNull()
    })

    test('shows a rate-limit message and lets the person try again', async () => {
      const onResetRequest = vi.fn().mockResolvedValue({ ok: false, error: 'Too many requests. Please wait a few minutes and try again.' })
      render(<Login onLogin={vi.fn()} onStartOnboarding={vi.fn()} onResetRequest={onResetRequest} />)
      fireEvent.click(screen.getByText('Forgot your password?'))
      fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.co' } })
      fireEvent.click(screen.getByText('Send reset link'))
      expect((await screen.findByRole('alert')).textContent).toMatch(/Too many requests/)
      expect(screen.getByText('Send reset link').disabled).toBe(false)
    })

    test('goes back to sign in', () => {
      render(<Login onLogin={vi.fn()} onStartOnboarding={vi.fn()} onResetRequest={vi.fn()} />)
      fireEvent.click(screen.getByText('Forgot your password?'))
      fireEvent.click(screen.getByText('← Back to sign in'))
      expect(screen.getByText('Sign In →')).toBeTruthy()
    })
  })
})
