import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom() { throw new Error('boom') }

describe('error boundary', () => {
  afterEach(() => vi.restoreAllMocks())

  test('shows a plain message and a way back instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toMatch(/Something went wrong/)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /@zeeder\.ai/ })).toBeTruthy()
  })

  test('renders its children when nothing is wrong', () => {
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>)
    expect(screen.getByText('fine')).toBeTruthy()
  })
})
