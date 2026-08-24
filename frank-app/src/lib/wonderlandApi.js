// In dev, Vite proxies /wl-api → Replit (avoids CORS). In production, call directly.
const BASE = import.meta.env.DEV
  ? '/wl-api'
  : 'https://wonderland-management.replit.app'

const key  = import.meta.env.VITE_FINANCE_API_KEY

const get = async (path) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Wonderland API ${res.status} — ${path}`)
  return res.json()
}

const monthLabel = (date = new Date()) =>
  date.toLocaleString('en-US', { month: 'long' }) + ' ' + date.getFullYear()

const yearRange = (date = new Date()) => ({
  from: `${date.getFullYear()}-01-01`,
  to:   `${date.getFullYear()}-12-31`,
})

export const wonderlandApi = {
  summary:     (month = monthLabel()) =>
    get(`/api/external/v1/summary?month=${encodeURIComponent(month)}`),

  outstanding: (month = monthLabel()) =>
    get(`/api/external/v1/outstanding?month=${encodeURIComponent(month)}`),

  children: (status = 'Active') =>
    get(`/api/external/v1/children?status=${status}`),

  payments: (from = yearRange().from, to = yearRange().to) =>
    get(`/api/external/v1/payments?from=${from}&to=${to}`),
}
