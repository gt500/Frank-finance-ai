// POST { tenant_id, plan, first_name, last_name, email }
// Returns { redirect_url } — send the browser there to capture the card.
import { createClient } from "npm:@supabase/supabase-js@2"
import { initiateWebPayment } from "../_shared/paygate.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const APP_URL = Deno.env.get("APP_URL")! // e.g. https://app.zeederfinance.co.za

const PLANS: Record<string, number> = {
  growth: 99900, // R999.00 in cents
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  try {
    const { tenant_id, plan, first_name, last_name, email } = await req.json()
    if (!tenant_id || !plan || !email) {
      return json({ error: "tenant_id, plan and email are required" }, 400)
    }
    const amountCents = PLANS[plan]
    if (!amountCents) return json({ error: `Unknown plan: ${plan}` }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const merchantOrderId = `sub_${tenant_id}_${Date.now()}`

    const { payRequestId, redirectUrl } = await initiateWebPayment({
      merchantOrderId,
      amountCents,
      firstName: first_name ?? "Customer",
      lastName: last_name ?? "",
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
    headers: { "Content-Type": "application/json" },
  })
}
