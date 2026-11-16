import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResetPassword } from './ResetPassword'

const fill = (a, b) => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: a } })
  fireEvent.change(screen.getByLabelText('Repeat new password'), { target: { value: b } })
}

describe('choose a new password', () => {
  test('saves a matching password of 8 or more characters', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    render(<ResetPassword onSubmit={onSubmit} onCancel={vi.fn()} />)
    fill('long-enough-1', 'long-enough-1')
    fireEvent.click(screen.getByText('Save password'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('long-enough-1'))
  })

  test('refuses a short password or two that differ, without calling the server', async () => {
    const onSubmit = vi.fn()
    render(<ResetPassword onSubmit={onSubmit} onCancel={vi.fn()} />)
    fill('short', 'short')
    fireEvent.click(screen.getByText('Save password'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/at least 8/)
    fill('long-enough-1', 'long-enough-2')
    fireEvent.click(screen.getByText('Save password'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/do not match/)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('shows the server message when it refuses, and stays on the page', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, error: 'New password should be different from the old password.' })
    render(<ResetPassword onSubmit={onSubmit} onCancel={vi.fn()} />)
    fill('long-enough-1', 'long-enough-1')
    fireEvent.click(screen.getByText('Save password'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/different from the old/)
    expect(screen.getByText('Save password').disabled).toBe(false)
  })

  test('can be cancelled', () => {
    const onCancel = vi.fn()
    render(<ResetPassword onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel and sign out'))
    expect(onCancel).toHaveBeenCalled()
  })
})
