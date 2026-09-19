// The frontend can never delete its own auth.users row — that needs the
// service role's admin API. Caller must be authenticated; we only ever
// delete the calling user's own account, never an arbitrary id passed in.
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  const userId = userData.user.id

  // Clean up owned rows first — profiles cascades on auth.users delete, but
  // subscriptions/billing_notifications reference tenant_id, not user id,
  // so they're left alone intentionally (billing history should outlive an
  // account deletion for audit purposes).
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) return json({ error: delErr.message }, 500)

  return json({ deleted: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
