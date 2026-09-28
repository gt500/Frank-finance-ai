const BASE = import.meta.env.DEV
  ? '/simplepay/external_users'
  : 'https://payroll.simplepay.cloud/external_users'

const authHeader = (apiKey) => 'Basic ' + btoa(`${apiKey}:`)

const get = async (path, apiKey) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: authHeader(apiKey), Accept: 'application/json' },
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`SimplePay ${res.status} — check API key and endpoint`)
  return res.json()
}

// Returns null on failure so callers can show "not connected" state
const safeGet = async (path, apiKey) => {
  try { return await get(path, apiKey) }
  catch { return null }
}

export const simplePayApi = {
  employees: (apiKey) => safeGet('/employees.json', apiKey),
  payRuns:   (apiKey) => safeGet('/pay_runs.json', apiKey),
  // Throws instead of swallowing — used to validate a key before saving it
  verify:    (apiKey) => get('/employees.json', apiKey),
}
