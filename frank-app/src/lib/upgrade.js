import { supabase } from './supabaseClient'

/**
 * Starts the PayGate checkout for a pack and sends the browser there.
 * Never throws: returns { ok: false, error } so the caller can show the problem.
 */
export async function startUpgrade({ planId, user }) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, error: 'Not signed in. Please log in again.' }
    const [first, ...rest] = String(user?.name ?? '').split(' ')
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paygate-initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan: planId, first_name: first || undefined, last_name: rest.join(' ') || undefined }),
    })
    const out = await res.json().catch(() => ({}))
    if (out.redirect_url) { window.location.href = out.redirect_url; return { ok: true } }
    return { ok: false, error: out.error ?? 'unknown error' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
