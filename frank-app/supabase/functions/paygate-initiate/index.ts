// POST { plan, first_name, last_name } — tenant_id and email come from the
// caller's own profile, never trusted from the request body. Returns
// { redirect_url } — send the browser there to capture the card.
//
// SECURITY: this function previously had verify_jwt=false and no in-code
// auth check, so any unauthenticated caller could insert a subscriptions
// row for an arbitrary tenant_id and trigger real PayGate API calls.
import { createClient } from "npm:@supabase/supabase-js@2"
import { initiateWebPayment } from "../_shared/paygate.ts"
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const APP_URL = Deno.env.get("APP_URL")! // e.g. https://app.zeederfinance.co.za

const PLANS: Record<string, number> = {
  growth: 99900, // R999.00 in cents
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("tenant_id, email, name")
    .eq("id", userData.user.id)
    .single()
  if (profileErr || !profile) return json({ error: "No profile found for this account" }, 404)

  try {
    const { plan, first_name, last_name } = await req.json()
    const amountCents = PLANS[plan]
    if (!amountCents) return json({ error: `Unknown plan: ${plan}` }, 400)

    const tenant_id = profile.tenant_id
    const email = profile.email
    const merchantOrderId = `sub_${tenant_id}_${Date.now()}`

    const { payRequestId, redirectUrl } = await initiateWebPayment({
      merchantOrderId,
      amountCents,
      firstName: first_name ?? profile.name?.split(" ")[0] ?? "Customer",
      lastName: last_name ?? profile.name?.split(" ").slice(1).join(" ") ?? "",
      email,
      notifyUrl: `${SUPABASE_URL}/functions/v1/paygate-notify`,
      returnUrl: `${APP_URL}/billing/return`,
    })

    // Record the pending subscription attempt before sending the user off-site.
    const { error } = await supabase.from("subscriptions").insert({
      tenant_id,
      plan,
      amount_cents: amountCents,
      currency: "ZAR",
      status: "pending",
      pay_request_id: payRequestId,
      merchant_order_id: merchantOrderId,
    })
    if (error) throw error

    return json({ redirect_url: redirectUrl, pay_request_id: payRequestId })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
