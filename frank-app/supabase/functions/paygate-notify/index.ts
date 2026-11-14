// PayGate POSTs here (form-encoded) once the customer finishes on the
// hosted page. We don't trust the POST body for the result — we Query
// PayGate directly for the authoritative status (standard PayHost pattern).
//
// Only an open checkout attempt (pending/superseded) can be settled. A row the
// user cancelled, or one already active, is never touched — so replaying an old
// PAY_REQUEST_ID cannot reactivate a cancelled or deleted account's billing.
import { createClient } from "npm:@supabase/supabase-js@2"
import { queryPayRequest } from "../_shared/paygate.ts"
import { notifyOps } from "../_shared/notify.ts"
import { notifyTransition, NOTIFIABLE_STATUSES, addOneMonth } from "../../../src/lib/billing.js"

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

    const next = notifyTransition(transactionStatus)
    if (!next) return new Response("OK", { status: 200 }) // not settled yet — leave it pending

    const now = new Date()
    const update = next === "active"
      ? { status: "active", vault_id: vaultId, result_code: resultCode, activated_at: now.toISOString(),
          last_charged_at: now.toISOString(), next_charge_at: addOneMonth(now).toISOString(), failed_charge_count: 0 }
      : { status: "failed", result_code: resultCode }

    const { data: rows, error } = await supabase
      .from("subscriptions")
      .update(update)
      .eq("pay_request_id", payRequestId)
      .in("status", NOTIFIABLE_STATUSES)
      .select("id, tenant_id")

    if (error?.code === "23505") {
      // Tenant already has an active subscription, so the customer paid twice. Flag the row
      // for a manual refund and ack, so PayGate stops retrying.
      console.error(`paygate-notify: DOUBLE PAYMENT on ${payRequestId} — refund needed`)
      const { data: flagged, error: flagErr } = await supabase.from("subscriptions")
        .update({ status: "duplicate_paid", vault_id: vaultId, result_code: resultCode })
        .eq("pay_request_id", payRequestId).in("status", NOTIFIABLE_STATUSES)
        .select("id, tenant_id")
      if (flagErr) throw flagErr
      if (flagged?.length) {
        await notifyOps(supabase, { type: "duplicate_paid", tenant_id: flagged[0].tenant_id, subscription_id: flagged[0].id,
          detail: `PayGate checkout ${payRequestId} was paid, but this tenant already has an active subscription. Refund this payment.` })
      }
      return new Response("OK", { status: 200 })
    }
    if (error) throw error
    if (!rows?.length) console.warn(`paygate-notify: ${payRequestId} matched no open checkout — ignored (replay, recurring charge or already settled)`)

    // PayGate expects a 200 with no particular body to acknowledge receipt.
    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response("Error", { status: 500 })
  }
})
