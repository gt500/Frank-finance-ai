// Keeps the page title, description, canonical link and share tags right for the public page being shown.
// The static versions live in index.html (what crawlers and link previews read first).

export const SITE = 'https://zeederfinanceos.com'

function setTag(selector, create, value, attr = 'content') {
  let el = document.head.querySelector(selector)
  if (!el) { el = create(); document.head.appendChild(el) }
  el.setAttribute(attr, value)
}

export function setPageMeta({ title, description, path = '/' }) {
  const url = `${SITE}${path === '/' ? '/' : path}`
  document.title = title
  const meta = (key, name) => (val) => setTag(`meta[${key}="${name}"]`, () => { const m = document.createElement('meta'); m.setAttribute(key, name); return m }, val)
  meta('name', 'description')(description)
  meta('property', 'og:title')(title)
  meta('property', 'og:description')(description)
  meta('property', 'og:url')(url)
  meta('name', 'twitter:title')(title)
  meta('name', 'twitter:description')(description)
  setTag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l }, url, 'href')
}
