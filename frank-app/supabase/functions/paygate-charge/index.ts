// Called by the cron sweep (see migrations/20260919b) for each subscription
// whose next_charge_at is due. Uses the MOTO account since this is a
// merchant-initiated, card-not-present charge against the vault.
import { createClient } from "npm:@supabase/supabase-js@2"
import { chargeVault } from "../_shared/paygate.ts"
import { notifyDowngrade } from "../_shared/notify.ts"
import { nextDunningState } from "../../../src/lib/dunning.js"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  try {
    const { subscription_id } = await req.json()
    if (!subscription_id) return json({ error: "subscription_id required" }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: sub, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .single()
    if (fetchErr || !sub) return json({ error: "Subscription not found" }, 404)
    if (sub.status !== "active") return json({ skipped: true, reason: `status is ${sub.status}` })
    if (!sub.vault_id) return json({ error: "No vault_id on file for this subscription" }, 400)

    const merchantOrderId = `chg_${sub.tenant_id}_${Date.now()}`
    const result = await chargeVault({
      vaultId: sub.vault_id,
      merchantOrderId,
      amountCents: sub.amount_cents,
      firstName: sub.first_name ?? "Customer",
      lastName: sub.last_name ?? "",
      email: sub.email,
      notifyUrl: `${SUPABASE_URL}/functions/v1/paygate-notify`,
    })

    const approved = result.transactionStatus === "1"

    await supabase.from("subscription_charges").insert({
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
      const next = new Date()
      next.setMonth(next.getMonth() + 1)
      update.last_charged_at = new Date().toISOString()
      update.next_charge_at = next.toISOString()
    } else if (dunning.downgrade) {
      update.downgraded_at = new Date().toISOString()
      update.next_charge_at = null
    } else {
      const retry = new Date()
      retry.setDate(retry.getDate() + (dunning.retryInDays ?? 3))
      update.next_charge_at = retry.toISOString()
    }

    await supabase.from("subscriptions").update(update).eq("id", subscription_id)

    if (dunning.downgrade) {
      await notifyDowngrade(supabase, {
        id: sub.id,
        tenant_id: sub.tenant_id,
        email: sub.email,
        plan: sub.plan,
      })
    }

    return json({ approved, failed_charge_count: dunning.failed_charge_count, downgraded: dunning.downgrade, ...result })
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
