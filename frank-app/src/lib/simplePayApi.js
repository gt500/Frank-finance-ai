import { supabase } from './supabaseClient'
const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simplepay-proxy`
async function call(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in — please log in again.')
  const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `SimplePay error ${res.status}`)
  return data
}
// Read calls never throw, but keep the reason: { error } is distinguishable from "no records".
const safe = async (body) => { try { return await call(body) } catch (e) { return { error: e.message } } }
export const simplePayApi = {
  connect: async (apiKey, clientId) => { try { const r = await call({ action: 'connect', apiKey, clientId }); return { ok: true, ...r } } catch (e) { return { ok: false, error: e.message } } },
  disconnect: () => call({ action: 'disconnect' }),
  clients: () => safe({ action: 'clients' }),
  employees: () => safe({ action: 'employees' }),
  payRuns: () => safe({ action: 'payment_runs' }),
}