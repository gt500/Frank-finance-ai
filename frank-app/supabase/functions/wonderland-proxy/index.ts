// Replaces the direct browser -> wonderland-management.replit.app calls in
// wonderlandApi.js. That API sends no CORS headers, so the browser blocked
// it outright in production (the Vite dev proxy was masking this locally).
// Requires a Supabase Auth session so this can't be hammered anonymously.
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const WONDERLAND_API_KEY = Deno.env.get("WONDERLAND_API_KEY")!

const BASE = "https://wonderland-management.replit.app"

// Fixed allowlist — this is a proxy for our own frontend's 4 known calls,
// not an open passthrough. Keeps it from becoming an SSRF vector.
const ENDPOINTS: Record<string, string> = {
  summary: "/api/external/v1/summary",
  outstanding: "/api/external/v1/outstanding",
  children: "/api/external/v1/children",
  payments: "/api/external/v1/payments",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  try {
    const { endpoint, params } = await req.json()
    const path = ENDPOINTS[endpoint]
    if (!path) return json({ error: `Unknown endpoint: ${endpoint}` }, 400)

    const target = new URL(BASE + path)
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v != null) target.searchParams.set(k, String(v))
    }

    const res = await fetch(target, {
      headers: { Authorization: `Bearer ${WONDERLAND_API_KEY}` },
    })
    const data = await res.json()
    if (!res.ok) return json({ error: `Wonderland API ${res.status}` }, res.status)

    return json(data)
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
