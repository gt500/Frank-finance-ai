const BASE = import.meta.env.DEV
  ? '/simplepay/external_users'
  : 'https://payroll.simplepay.cloud/external_users'

const API_KEY = import.meta.env.VITE_SIMPLEPAY_API_KEY

// SimplePay uses HTTP Basic auth: username = API key, password = empty
const AUTH = 'Basic ' + btoa(`${API_KEY}:`)

const get = async (path) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: AUTH, Accept: 'application/json' },
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`SimplePay ${res.status} — check API key and endpoint`)
  return res.json()
}

// Returns null on failure so callers can show "not connected" state
const safeGet = async (path) => {
  try { return await get(path) }
  catch { return null }
}

export const simplePayApi = {
  employees: () => safeGet('/employees.json'),
  payRuns:   () => safeGet('/pay_runs.json'),
}
