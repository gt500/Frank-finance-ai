// The frontend can never delete its own auth.users row — that needs the
// service role's admin API. Caller must be authenticated; we only ever
// delete the calling user's own account, never an arbitrary id passed in.
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders, withCors } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  const userId = userData.user.id

  // Every cleanup step must succeed before the auth user goes: a deleted user whose
  // subscription is still active would keep being charged with no way to cancel.
  const { data: profile, error: profileErr } = await admin.from("profiles").select("tenant_id").eq("id", userId).maybeSingle()
  if (profileErr) return fail("profile lookup", profileErr)
  if (profile?.tenant_id) {
    const tid = profile.tenant_id
    const steps: [string, PromiseLike<{ error: unknown }>][] = [
      ["stop billing", admin.from("subscriptions").update({ status: "cancelled", next_charge_at: null }).eq("tenant_id", tid).in("status", ["active", "pending", "superseded"])],
      ["delete invoices, ledger and mailbox", admin.rpc("purge_tenant_ledger", { p_tenant: tid })],
      ["delete tenant_data", admin.from("tenant_data").delete().eq("tenant_id", tid)],
      ["delete tenant_secrets", admin.from("tenant_secrets").delete().eq("tenant_id", tid)],
      ["delete tenants", admin.from("tenants").delete().eq("id", tid)],
    ]
    for (const [step, query] of steps) {
      const { error } = await query
      if (error) return fail(step, error)
    }
  }

  // Clean up owned rows first — profiles cascades on auth.users delete, but
  // subscriptions/billing_notifications reference tenant_id, not user id,
  // so they're left alone intentionally (billing history should outlive an
  // account deletion for audit purposes).
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) return fail("delete auth user", delErr)

  return json({ deleted: true })
}))

function fail(step: string, error: unknown) {
  console.error(`delete-account: ${step} failed — account NOT deleted`, error)
  return json({ error: "Could not delete your account right now — it is still active. Please try again." }, 500)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
