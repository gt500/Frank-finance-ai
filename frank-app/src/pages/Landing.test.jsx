import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Landing, PAGE_TITLE } from './Landing'
import { PLANS, PLAN_ORDER } from '../lib/plans'

const show = (props = {}) => render(<Landing onStart={vi.fn()} onSignIn={vi.fn()} {...props} />)

describe('landing page', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  test('states what the product does and never promises live bank feeds', () => {
    show()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Know your cash/)
    const text = document.body.textContent
    expect(text).toMatch(/CSV, Excel or PDF/)
    expect(text).not.toMatch(/live bank|bank feed|bank connected|no manual entry/i)
  })

  test('has no dead buttons: no Watch Demo, and every button does something', () => {
    const onStart = vi.fn(); const onSignIn = vi.fn()
    show({ onStart, onSignIn })
    expect(screen.queryByText(/watch demo/i)).toBeNull()
    for (const b of screen.getAllByRole('button')) fireEvent.click(b)
    // header sign in, header start, hero start, and one start button per pack
    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledTimes(2 + PLAN_ORDER.length)
  })

  test('the sample numbers are marked as an example', () => {
    show()
    const card = screen.getByLabelText('Example dashboard')
    expect(within(card).getByText('Example')).toBeTruthy()
    expect(within(card).getByText(/Example figures for illustration/)).toBeTruthy()
  })

  test('pricing shows the three packs, each with its grouped features, and each starts that pack', () => {
    const onStart = vi.fn()
    show({ onStart })
    for (const id of PLAN_ORDER) {
      const pack = screen.getByRole('article', { name: PLANS[id].name })
      for (const [heading, items] of PLANS[id].groups) {
        expect(within(pack).getByRole('heading', { name: heading, level: 4 })).toBeTruthy()
        for (const item of items) expect(within(pack).getByText(item)).toBeTruthy()
      }
      fireEvent.click(within(pack).getByRole('button', { name: new RegExp(`Start ${PLANS[id].name}`) }))
      expect(onStart).toHaveBeenLastCalledWith(id)
    }
    expect(document.body.textContent).toMatch(/R 499/)
    expect(document.body.textContent).toMatch(/R 999/)
    expect(document.body.textContent).toMatch(/R 1 999/)
  })

  test('footer links to real privacy and terms pages and a contact address', () => {
    show()
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Privacy notice' }).getAttribute('href')).toBe('/privacy')
    expect(within(footer).getByRole('link', { name: 'Terms of use' }).getAttribute('href')).toBe('/terms')
    expect(footer.textContent).toMatch(/POPIA/)
    expect(within(footer).getByRole('link', { name: /@zeeder\.ai/ })).toBeTruthy()
  })

  test('accessibility basics: skip link, landmarks, one h1, no emoji icons', () => {
    show()
    expect(screen.getByText('Skip to content').getAttribute('href')).toBe('#main')
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(document.body.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}⚡]/u)
  })

  test('sets the page title, description and canonical link for search and sharing', () => {
    show()
    expect(document.title).toBe(PAGE_TITLE)
    expect(document.head.querySelector('meta[name="description"]').content.length).toBeGreaterThan(60)
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe('https://zeederfinanceos.com/')
  })
})
