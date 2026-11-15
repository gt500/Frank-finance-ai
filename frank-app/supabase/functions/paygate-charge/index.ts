// Called by the cron sweep (see migrations/20260919b) for each subscription
// whose next_charge_at is due. Uses the MOTO account since this is a
// merchant-initiated, card-not-present charge against the vault.
import { createClient } from "npm:@supabase/supabase-js@2"
import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { chargeVault } from "../_shared/paygate.ts"
import { notifyDowngrade, notifyOps } from "../_shared/notify.ts"
import { nextDunningState } from "../../../src/lib/dunning.js"
import { addOneMonth } from "../../../src/lib/billing.js"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const cronToken = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  let cronRole = ""
  try { cronRole = JSON.parse(atob(cronToken.split(".")[1] ?? "")).role ?? "" } catch { /* ignore */ }
  if (cronRole !== "service_role") return json({ error: "Forbidden" }, 403)

  try {
    const { subscription_id } = await req.json()
    if (!subscription_id) return json({ error: "subscription_id required" }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Claim the row BEFORE charging: push next_charge_at a month out, only if it is
    // still due. A concurrent/duplicate call matches nothing and skips, and if
    // anything below fails after PayGate took the money, the next hourly sweep
    // won't charge again. (Worst case is a missed retry, never a double charge.)
    const { data: claimed, error: claimErr } = await supabase
      .from("subscriptions")
      .update({ next_charge_at: addOneMonth(new Date()).toISOString() })
      .eq("id", subscription_id)
      .eq("status", "active")
      .lte("next_charge_at", new Date().toISOString())
      .select("*")
    if (claimErr) throw claimErr
    const sub = claimed?.[0]
    if (!sub) return json({ skipped: true, reason: "not active or not due" })
    if (!sub.vault_id) {
      // Can never be charged: stop scheduling instead of silently granting a free month each cycle.
      console.error(`paygate-charge: subscription ${sub.id} is active with no vault_id — unscheduled, needs attention`)
      const { error: unschedErr } = await supabase.from("subscriptions").update({ next_charge_at: null }).eq("id", sub.id)
      if (unschedErr) console.error(`paygate-charge: failed to unschedule ${sub.id}`, unschedErr)
      return json({ error: "No vault_id on file for this subscription" }, 400)
    }

    const merchantOrderId = `chg_${sub.tenant_id}_${Date.now()}`
    let result
    try {
      result = await chargeVault({
        vaultId: sub.vault_id,
        merchantOrderId,
        amountCents: sub.amount_cents,
        firstName: sub.first_name ?? "Customer",
        lastName: sub.last_name ?? "",
        email: sub.email,
        notifyUrl: `${SUPABASE_URL}/functions/v1/paygate-notify`,
      })
    } catch (chargeErr) {
      // Outcome unknown (e.g. timeout after PayGate processed it). The row stays claimed,
      // so no automatic retry; record it so someone can reconcile against PayGate.
      console.error(`paygate-charge: outcome UNKNOWN for ${merchantOrderId} — reconcile manually`, chargeErr)
      await recordCharge(supabase, { subscription_id, merchant_order_id: merchantOrderId, amount_cents: sub.amount_cents, status: "unknown", result_desc: String(chargeErr).slice(0, 200) })
      await notifyOps(supabase, { type: "charge_unknown", tenant_id: sub.tenant_id, subscription_id: sub.id,
        detail: `Recurring charge ${merchantOrderId} (R ${(sub.amount_cents / 100).toFixed(2)}) failed with an unknown outcome. Check PayGate: if it went through, set last_charged_at; if not, set next_charge_at to now to retry.` })
      return json({ error: "Charge outcome unknown — flagged for reconciliation" }, 502)
    }

    const approved = result.transactionStatus === "1"

    await recordCharge(supabase, {
      subscription_id,
      merchant_order_id: merchantOrderId,
      amount_cents: sub.amount_cents,
      status: approved ? "success" : "failed",
      result_code: result.resultCode,
      result_desc: result.resultDesc,
    })

    const dunning = nextDunningState(sub.failed_charge_count ?? 0, approved)

    const update: Record<string, unknown> = {
      status: dunning.status,
      failed_charge_count: dunning.failed_charge_count,
    }

    if (approved) {
      update.last_charged_at = new Date().toISOString() // next_charge_at already set by the claim
    } else if (dunning.downgrade) {
      update.downgraded_at = new Date().toISOString()
      update.next_charge_at = null
    } else {
      const retry = new Date()
      retry.setDate(retry.getDate() + (dunning.retryInDays ?? 3))
      update.next_charge_at = retry.toISOString()
    }

    const { error: updErr } = await supabase.from("subscriptions").update(update).eq("id", subscription_id)
    if (updErr) console.error(`paygate-charge: charge ${merchantOrderId} recorded (approved=${approved}) but subscription update failed — row stays claimed`, updErr)

    if (dunning.downgrade) {
      try {
        await notifyDowngrade(supabase, { id: sub.id, tenant_id: sub.tenant_id, email: sub.email, plan: sub.plan })
      } catch (notifyErr) {
        console.error(`paygate-charge: downgrade notice failed for ${sub.id}`, notifyErr)
      }
    }

    return json({ approved, failed_charge_count: dunning.failed_charge_count, downgraded: dunning.downgrade, ...result })
  } catch (err) {
    console.error(err)
    return json({ error: "Charge failed — see function logs" }, 500)
  }
})

// A missing charge row hides money that moved, so a failed insert is logged loudly but
// does not undo the (already claimed) subscription update.
async function recordCharge(supabase: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await supabase.from("subscription_charges").insert(row)
  if (error) console.error(`paygate-charge: FAILED to record charge ${row.merchant_order_id} (${row.status})`, error)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
