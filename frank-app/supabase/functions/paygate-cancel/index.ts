import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: u, error } = await admin.auth.getUser(token)
  if (error || !u?.user) return json({ error: "Invalid session" }, 401)
  const { data: p } = await admin.from("profiles").select("tenant_id").eq("id", u.user.id).single()
  if (!p) return json({ error: "No profile" }, 404)
  const { error: upErr } = await admin.from("subscriptions").update({ status: "cancelled", next_charge_at: null }).eq("tenant_id", p.tenant_id).eq("status", "active")
  if (upErr) return json({ error: upErr.message }, 500)
  return json({ cancelled: true })
})
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...corsHeaders } }) }