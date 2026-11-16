// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { PLANS, PLAN_ORDER } from './plans'

const root = new URL('../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

describe('search and sharing files', () => {
  const html = read('index.html')

  test('index.html has a description, canonical link, share tags and an image that exists', () => {
    expect(html).toMatch(/<meta name="description" content="[^"]{60,}"/)
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/zeederfinanceos\.com\/"/)
    expect(html).toMatch(/property="og:title"/)
    expect(html).toMatch(/name="twitter:card" content="summary_large_image"/)
    expect(html).toMatch(/og:image" content="https:\/\/zeederfinanceos\.com\/og-image\.png"/)
    expect(statSync(new URL('public/og-image.png', root)).size).toBeGreaterThan(10_000)
  })

  test('the favicon the page points to exists', () => {
    expect(html).toMatch(/href="\/frank-icon\.svg"/)
    expect(existsSync(new URL('public/frank-icon.svg', root))).toBe(true)
  })

  test('structured data lists the same three prices as the packs', () => {
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
    expect(ld.offers.map((o) => [o.name, Number(o.price)])).toEqual(PLAN_ORDER.map((id) => [PLANS[id].name, PLANS[id].price]))
  })

  test('robots.txt and sitemap.xml are real files that list the public pages', () => {
    expect(read('public/robots.txt')).toMatch(/Sitemap: https:\/\/zeederfinanceos\.com\/sitemap\.xml/)
    const sitemap = read('public/sitemap.xml')
    for (const path of ['/', '/privacy', '/terms']) expect(sitemap).toContain(`<loc>https://zeederfinanceos.com${path}</loc>`)
  })

  test('the content security policy has no inline scripts and blocks framing and plugins', () => {
    const csp = JSON.parse(read('vercel.json')).headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(csp).toMatch(/frame-ancestors 'none'/)
    expect(csp).toMatch(/object-src 'none'/)
    expect(csp).toMatch(/base-uri 'self'/)
  })
})
