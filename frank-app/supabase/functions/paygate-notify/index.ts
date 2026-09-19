// PayGate POSTs here (form-encoded) once the customer finishes on the
// hosted page. We don't trust the POST body for the result — we Query
// PayGate directly for the authoritative status (standard PayHost pattern).
import { createClient } from "npm:@supabase/supabase-js@2"
import { queryPayRequest } from "../_shared/paygate.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  try {
    const form = await req.formData()
    const payRequestId = String(form.get("PAY_REQUEST_ID") ?? form.get("PayRequestId") ?? "")
    if (!payRequestId) return new Response("Missing PAY_REQUEST_ID", { status: 400 })

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { transactionStatus, vaultId, resultCode } = await queryPayRequest(payRequestId)

    // TransactionStatus 1 = approved/completed. Anything else = failed/cancelled.
    const approved = transactionStatus === "1"

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: approved ? "active" : "failed",
        vault_id: vaultId,
        result_code: resultCode,
        activated_at: approved ? new Date().toISOString() : null,
      })
      .eq("pay_request_id", payRequestId)

    if (error) throw error

    // PayGate expects a 200 with no particular body to acknowledge receipt.
    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response("Error", { status: 500 })
  }
})
