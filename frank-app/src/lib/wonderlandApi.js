import { supabase } from './supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// Routed through the wonderland-proxy edge function — Wonderland's API sends
// no CORS headers, so the browser can't call it directly (blocked in prod).
const call = async (endpoint, params) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in — please log in again.')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/wonderland-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint, params }),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Wonderland API error ${res.status}`)
  return data
}

const monthLabel = (date = new Date()) =>
  date.toLocaleString('en-US', { month: 'long' }) + ' ' + date.getFullYear()

const yearRange = (date = new Date()) => ({
  from: `${date.getFullYear()}-01-01`,
  to:   `${date.getFullYear()}-12-31`,
})

export const wonderlandApi = {
  summary:     (month = monthLabel()) => call('summary', { month }),
  outstanding: (month = monthLabel()) => call('outstanding', { month }),
  children:    (status = 'Active')    => call('children', { status }),
  payments:    (from = yearRange().from, to = yearRange().to) => call('payments', { from, to }),
}
