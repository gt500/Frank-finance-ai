import { createClient } from "npm:@supabase/supabase-js@2"
import { PACK_AI_REQUESTS, planFor } from "./packs.js"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const TRIAL_DAYS = 14
// Daily AI requests (chat + document reads). ponytail: flat caps, tune per plan once usage data exists.
const TRIAL_DAILY_CAP = 50, PAID_DAILY_CAP = 500, PARTNER_DAILY_CAP = 1000
const PARTNER_TENANTS = new Set(["wonderland-educare", "cape-fresh-grocery"])
type Entitlement = { ok: true; plan: string } | { ok: false; reason: string }
// Fails closed: a DB error must neither grant unlimited AI nor tell a paying customer their trial ended.
const TRY_AGAIN: Entitlement = { ok: false, reason: "Zeeder couldn't verify your plan just now — please try again in a moment." }

export async function checkEntitlement(userId: string): Promise<Entitlement> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: p, error: pErr } = await admin.from("profiles").select("tenant_id, created_at").eq("id", userId).maybeSingle()
  if (pErr) return fail("profile lookup", pErr)
  if (!p) return { ok: false, reason: "No profile found." }
  let plan: string
  if (PARTNER_TENANTS.has(p.tenant_id)) {
    plan = "partner"
  } else {
    const { data: sub, error: subErr } = await admin.from("subscriptions").select("plan").eq("tenant_id", p.tenant_id).eq("status", "active").limit(1).maybeSingle()
    if (subErr) return fail("subscription lookup", subErr)
    if (sub) {
      plan = sub.plan
    } else {
      const trialEnds = new Date(p.created_at).getTime() + TRIAL_DAYS * 86400000
      if (Date.now() >= trialEnds) return { ok: false, reason: "Your 14-day trial has ended. Upgrade to keep using Zeeder AI." }
      plan = "trial"
    }
  }
  // Every plan has a daily ceiling, so no single account can run up an unbounded AI bill.
  const { error: incErr } = await admin.rpc("increment_ai_usage", { tid: p.tenant_id })
  if (incErr) return fail("usage increment", incErr)
  const { data: row, error: rowErr } = await admin.from("ai_usage").select("count").eq("tenant_id", p.tenant_id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle()
  if (rowErr || !row) return fail("usage read", rowErr)
  const cap = plan === "trial" ? TRIAL_DAILY_CAP : plan === "partner" ? PARTNER_DAILY_CAP : PAID_DAILY_CAP
  if (row.count > cap) {
    return { ok: false, reason: plan === "trial" ? "Daily trial AI limit reached. Upgrade for more." : "You've reached today's Zeeder AI limit — it resets at midnight (UTC)." }
  }
  // The pack's monthly allowance of questions and document reads. Our own partner workspaces are exempt.
  if (plan !== "partner") {
    const { data: t, error: tErr } = await admin.from("tenants").select("profile").eq("id", p.tenant_id).maybeSingle()
    if (tErr) return fail("tenant lookup", tErr)
    const pack = planFor({ tenantId: p.tenant_id, subscription: plan === "trial" ? null : { plan }, chosen: t?.profile?.plan, trialStart: t?.profile?.trialStart }) as keyof typeof PACK_AI_REQUESTS
    const monthStart = new Date().toISOString().slice(0, 8) + "01"
    const { data: days, error: mErr } = await admin.from("ai_usage").select("count").eq("tenant_id", p.tenant_id).gte("day", monthStart)
    if (mErr) return fail("monthly usage read", mErr)
    const used = (days ?? []).reduce((n: number, d: { count: number }) => n + d.count, 0)
    if (used > PACK_AI_REQUESTS[pack]) {
      return { ok: false, reason: `You've used all ${PACK_AI_REQUESTS[pack]} Zeeder AI questions and document reads in your ${pack[0].toUpperCase() + pack.slice(1)} pack this month. Upgrade for more, or wait until next month.` }
    }
  }
  return { ok: true, plan }
}

function fail(step: string, error: unknown): Entitlement {
  console.error(`entitlement: ${step} failed`, error)
  return TRY_AGAIN
}
