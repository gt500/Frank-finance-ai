// Notification is decoupled from the payment logic on purpose: whatever
// happens with PayGate, this always leaves a row so the app/ops can see
// it, even if the email send itself fails or no provider is wired up yet.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2"

export async function notifyDowngrade(
  supabase: SupabaseClient,
  sub: { id: string; tenant_id: string; email: string; plan: string },
) {
  const { error } = await supabase.from("billing_notifications").insert({
    tenant_id: sub.tenant_id,
    subscription_id: sub.id,
    type: "downgrade",
    channel: "email",
    status: "pending",
    payload: { email: sub.email, plan: sub.plan },
  })
  if (error) console.error("Failed to record billing_notifications row:", error)

  // Optional direct send via Resend, if configured. Not required — the
  // row above is the source of truth either way, so a missing/failed
  // send here doesn't block the downgrade itself.
  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromAddress = Deno.env.get("BILLING_FROM_EMAIL")
  if (!resendKey || !fromAddress) {
    console.warn("RESEND_API_KEY/BILLING_FROM_EMAIL not set — downgrade email left as pending row only")
    return
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: sub.email,
        subject: "Your Zeeder Finance OS plan has been downgraded",
        text:
          `We weren't able to charge your card for the ${sub.plan} plan after several attempts, ` +
          `so your account has been moved back to the free plan. Update your card details and ` +
          `upgrade again any time from the sidebar.`,
      }),
    })
    await supabase
      .from("billing_notifications")
      .update({ status: res.ok ? "sent" : "failed" })
      .eq("subscription_id", sub.id)
      .eq("type", "downgrade")
      .eq("status", "pending")
  } catch (err) {
    console.error("Downgrade email send failed:", err)
  }
}

// Billing states a human must act on (refund a double payment, reconcile an unknown charge).
// Always leaves a billing_notifications row; emails ALERT_EMAIL (else BILLING_FROM_EMAIL) via Resend if configured.
export async function notifyOps(
  supabase: SupabaseClient,
  alert: { type: "duplicate_paid" | "charge_unknown"; tenant_id: string | null; subscription_id: string | null; detail: string },
) {
  const { error } = await supabase.from("billing_notifications").insert({
    tenant_id: alert.tenant_id,
    subscription_id: alert.subscription_id,
    type: `ops_${alert.type}`,
    channel: "email",
    status: "pending",
    payload: { detail: alert.detail },
  })
  if (error) console.error("Failed to record ops alert row:", error)

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromAddress = Deno.env.get("BILLING_FROM_EMAIL")
  const to = Deno.env.get("ALERT_EMAIL") || fromAddress
  if (!resendKey || !fromAddress || !to) return
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject: alert.type === "duplicate_paid" ? "ACTION: customer paid twice — refund needed" : "ACTION: charge outcome unknown — reconcile with PayGate",
        text: `${alert.detail}\n\nTenant: ${alert.tenant_id ?? "?"}\nSubscription: ${alert.subscription_id ?? "?"}`,
      }),
    })
    if (!res.ok) console.error("Ops alert email failed:", res.status)
  } catch (err) {
    console.error("Ops alert email failed:", err)
  }
}
