import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const BASE = "https://api.payroll.simplepay.cloud/v1"

// Official SA API: raw key in the Authorization header (NOT Basic/Bearer).
async function sp(path: string, key: string) {
  const res = await fetch(BASE + path, { headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json" } })
  if (!res.ok) throw new Error(`SimplePay ${res.status} — check API key`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: u, error } = await admin.auth.getUser(token)
  if (error || !u?.user) return json({ error: "Invalid session" }, 401)
  const { data: p, error: pErr } = await admin.from("profiles").select("tenant_id").eq("id", u.user.id).maybeSingle()
  if (pErr) return saveFailed("profile lookup", pErr)
  if (!p) return json({ error: "No profile" }, 404)
  const tid = p.tenant_id
  try {
    const { action, apiKey, clientId } = await req.json()
    if (action === "connect") {
      const key = String(apiKey ?? "").trim()
      if (!key) return json({ error: "Enter an API key" }, 400)
      const clients = await sp("/clients/", key)
      const list = Array.isArray(clients) ? clients : []
      const cid = clientId ?? list[0]?.client?.id ?? list[0]?.id
      if (!cid) return json({ error: "No company found for this API key" }, 400)
      const { error: keyErr } = await admin.from("tenant_secrets").upsert({ tenant_id: tid, simplepay_key: key, simplepay_client_id: String(cid), updated_at: new Date().toISOString() })
      if (keyErr) return saveFailed("store key", keyErr)
      const { error: flagErr } = await admin.from("tenant_data").upsert({ tenant_id: tid, simplepay_connected: true }, { onConflict: "tenant_id" })
      if (flagErr) return saveFailed("set connected", flagErr)
      return json({ ok: true, clientId: cid, clients: list })
    }
    if (action === "disconnect") {
      // Delete the key first: if that fails the UI must not claim the key is gone.
      const { error: delErr } = await admin.from("tenant_secrets").delete().eq("tenant_id", tid)
      if (delErr) return saveFailed("delete key", delErr)
      const { error: flagErr } = await admin.from("tenant_data").upsert({ tenant_id: tid, simplepay_connected: false }, { onConflict: "tenant_id" })
      if (flagErr) return saveFailed("clear connected", flagErr)
      return json({ ok: true })
    }
    const { data: sec } = await admin.from("tenant_secrets").select("simplepay_key, simplepay_client_id").eq("tenant_id", tid).maybeSingle()
    if (!sec?.simplepay_key) return json({ error: "SimplePay not connected" }, 404)
    const cid = sec.simplepay_client_id
    if (action === "clients") return json(await sp("/clients/", sec.simplepay_key))
    if (action === "employees") return json(await sp(`/clients/${cid}/employees`, sec.simplepay_key))
    if (action === "payment_runs") return json(await sp(`/clients/${cid}/payment_runs`, sec.simplepay_key))
    return json({ error: "Unknown action" }, 400)
  } catch (err) { return json({ error: String(err) }, 502) }
})
function saveFailed(step: string, error: unknown) {
  console.error(`simplepay-proxy: ${step} failed`, error)
  return json({ error: "SimplePay request failed on our side — please try again." }, 500)
}
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...corsHeaders } }) }