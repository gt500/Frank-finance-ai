// GET /paygate-status?pay_request_id=xxx
// Public read-only status check for the billing return page — returns only
// what's safe to show the customer, nothing from PayGate's raw response.
import { createClient } from "npm:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const payRequestId = url.searchParams.get("pay_request_id")
  if (!payRequestId) return json({ error: "pay_request_id required" }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, plan, amount_cents, currency")
    .eq("pay_request_id", payRequestId)
    .single()

  if (error || !data) return json({ status: "unknown" }, 200)
  return json(data, 200)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}
