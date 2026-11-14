// GET /paygate-status?pay_request_id=xxx  (Authorization: Bearer <user JWT>)
// Status check for the billing return page — returns only what's safe to show
// the customer, and only for a checkout that belongs to the caller's own tenant.
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "GET, OPTIONS" } })

  const url = new URL(req.url)
  const payRequestId = url.searchParams.get("pay_request_id")
  if (!payRequestId) return json({ error: "pay_request_id required" }, 400)

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: u, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !u?.user) return json({ error: "Invalid session" }, 401)

  const { data: profile, error: profileErr } = await supabase.from("profiles").select("tenant_id").eq("id", u.user.id).maybeSingle()
  if (profileErr) return json({ error: "Could not check payment status" }, 500)
  if (!profile) return json({ status: "unknown" })

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, plan, amount_cents, currency")
    .eq("pay_request_id", payRequestId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle()

  if (error) return json({ error: "Could not check payment status" }, 500)
  if (!data) return json({ status: "unknown" })
  return json(data)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, "Access-Control-Allow-Methods": "GET, OPTIONS" },
  })
}
