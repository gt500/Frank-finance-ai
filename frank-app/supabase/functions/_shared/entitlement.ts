import { createClient } from "npm:@supabase/supabase-js@2"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const TRIAL_DAYS = 14, TRIAL_DAILY_CAP = 50
type Entitlement = { ok: true; plan: string } | { ok: false; reason: string }
// Fails closed: a DB error must neither grant unlimited AI nor tell a paying customer their trial ended.
const TRY_AGAIN: Entitlement = { ok: false, reason: "Zeeder couldn't verify your plan just now — please try again in a moment." }

export async function checkEntitlement(userId: string): Promise<Entitlement> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: p, error: pErr } = await admin.from("profiles").select("tenant_id, created_at").eq("id", userId).maybeSingle()
  if (pErr) return fail("profile lookup", pErr)
  if (!p) return { ok: false, reason: "No profile found." }
  if (p.tenant_id === "wonderland-educare" || p.tenant_id === "cape-fresh-grocery") return { ok: true, plan: "partner" }
  const { data: sub, error: subErr } = await admin.from("subscriptions").select("plan").eq("tenant_id", p.tenant_id).eq("status", "active").limit(1).maybeSingle()
  if (subErr) return fail("subscription lookup", subErr)
  if (sub) return { ok: true, plan: sub.plan }
  const trialEnds = new Date(p.created_at).getTime() + TRIAL_DAYS * 86400000
  if (Date.now() >= trialEnds) return { ok: false, reason: "Your 14-day trial has ended. Upgrade to keep using Zeeder AI." }
  const { error: incErr } = await admin.rpc("increment_ai_usage", { tid: p.tenant_id })
  if (incErr) return fail("usage increment", incErr)
  const { data: row, error: rowErr } = await admin.from("ai_usage").select("count").eq("tenant_id", p.tenant_id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle()
  if (rowErr || !row) return fail("usage read", rowErr)
  if (row.count > TRIAL_DAILY_CAP) return { ok: false, reason: "Daily trial AI limit reached. Upgrade for unlimited access." }
  return { ok: true, plan: "trial" }
}

function fail(step: string, error: unknown): Entitlement {
  console.error(`entitlement: ${step} failed`, error)
  return TRY_AGAIN
}
