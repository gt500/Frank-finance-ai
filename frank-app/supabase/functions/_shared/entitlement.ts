import { createClient } from "npm:@supabase/supabase-js@2"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const TRIAL_DAYS = 14, TRIAL_DAILY_CAP = 50
export async function checkEntitlement(userId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: p } = await admin.from("profiles").select("tenant_id, created_at").eq("id", userId).single()
  if (!p) return { ok: false, reason: "No profile found." }
  if (p.tenant_id === "wonderland-educare" || p.tenant_id === "cape-fresh-grocery") return { ok: true, plan: "partner" }
  const { data: sub } = await admin.from("subscriptions").select("plan").eq("tenant_id", p.tenant_id).eq("status", "active").limit(1).maybeSingle()
  if (sub) return { ok: true, plan: sub.plan }
  const trialEnds = new Date(p.created_at).getTime() + TRIAL_DAYS * 86400000
  if (Date.now() >= trialEnds) return { ok: false, reason: "Your 14-day trial has ended. Upgrade to keep using Zeeder AI." }
  await admin.rpc("increment_ai_usage", { tid: p.tenant_id })
  const { data: row } = await admin.from("ai_usage").select("count").eq("tenant_id", p.tenant_id).eq("day", new Date().toISOString().slice(0, 10)).single()
  if ((row?.count ?? 0) > TRIAL_DAILY_CAP) return { ok: false, reason: "Daily trial AI limit reached. Upgrade for unlimited access." }
  return { ok: true, plan: "trial" }
}