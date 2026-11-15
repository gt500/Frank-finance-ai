import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders, withCors } from "../_shared/cors.ts"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: u, error } = await admin.auth.getUser(token)
  if (error || !u?.user) return json({ error: "Invalid session" }, 401)
  const { data: p, error: pErr } = await admin.from("profiles").select("tenant_id").eq("id", u.user.id).maybeSingle()
  if (pErr) { console.error("paygate-cancel: profile lookup failed", pErr); return json({ error: "Could not cancel right now — please try again." }, 500) }
  if (!p) return json({ error: "No profile" }, 404)
  // 'cancelled' is final: paygate-notify never reactivates it. Open checkouts are closed too.
  const { data: rows, error: upErr } = await admin.from("subscriptions")
    .update({ status: "cancelled", next_charge_at: null })
    .eq("tenant_id", p.tenant_id).in("status", ["active", "pending", "superseded"])
    .select("id")
  if (upErr) { console.error("paygate-cancel: update failed", upErr); return json({ error: "Could not cancel right now — please try again." }, 500) }
  if (!rows?.length) return json({ error: "No active subscription to cancel." }, 404)
  return json({ cancelled: true })
}))
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...corsHeaders } }) }