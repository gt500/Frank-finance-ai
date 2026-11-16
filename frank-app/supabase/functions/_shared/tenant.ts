// Who is calling? Resolved from the caller's own session; a tenant id sent in a request body is never trusted.
import { createClient } from "npm:@supabase/supabase-js@2"

export const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

export async function tenantForToken(token: string): Promise<{ tenantId: string } | null> {
  const db = admin()
  const { data: u, error } = await db.auth.getUser(token)
  if (error || !u?.user) return null
  const { data: p, error: pErr } = await db.from("profiles").select("tenant_id").eq("id", u.user.id).maybeSingle()
  if (pErr) { console.error("tenant lookup failed:", pErr); return null }
  return p?.tenant_id ? { tenantId: p.tenant_id } : null
}
