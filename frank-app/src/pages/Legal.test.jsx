import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Legal } from './Legal'
import { LEGAL } from './legalContent'

describe('privacy notice', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  test('covers what POPIA asks us to tell people', () => {
    render(<Legal page="privacy" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeTruthy()
    for (const h of ['Who is responsible', 'What we collect', 'Why we use it', 'Who we share it with', 'How long we keep it', 'Your rights', 'Contact us']) {
      expect(screen.getByRole('heading', { level: 2, name: h })).toBeTruthy()
    }
    const text = document.body.textContent
    expect(text).toMatch(/Protection of Personal Information Act/)
    expect(text).toMatch(/Information Regulator/)
    expect(text).toMatch(/Anthropic/) // AI processing, outside South Africa
    expect(text).toMatch(/never see or store your card number/)
  })

  test('says when it was last updated, gives a contact address, and sets its own canonical link', () => {
    render(<Legal page="privacy" />)
    expect(screen.getByText(`Last updated ${LEGAL.updated}`)).toBeTruthy()
    expect(screen.getAllByRole('link', { name: LEGAL.email }).length).toBeGreaterThan(0)
    expect(document.title).toBe('Privacy notice | Zeeder Finance OS')
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe('https://zeederfinanceos.com/privacy')
  })
})

describe('terms of use', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  test('covers the trial, billing, cancelling and that reports are not professional advice', () => {
    render(<Legal page="terms" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeTruthy()
    const text = document.body.textContent
    expect(text).toMatch(/14-day free trial/)
    expect(text).toMatch(/PayGate/)
    expect(text).toMatch(/cancel at any time/i)
    expect(text).toMatch(/not accounting, tax, legal or financial advice/)
    expect(text).toMatch(/Consumer Protection Act/)
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe('https://zeederfinanceos.com/terms')
  })

  test('registration, address and officer appear only once they are filled in', () => {
    render(<Legal page="terms" />)
    expect(document.body.textContent).not.toMatch(/registration number|Information Officer:/)
  })
})
