// Replaces the direct browser -> api.anthropic.com call in useFrank.js.
// Requires a Supabase Auth session so this can't be hammered anonymously.
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// .trim() defensively — a stray trailing newline/space from copy-pasting the
// secret in produces a malformed x-api-key header and a confusing non-JSON
// 503 from Anthropic's edge instead of a clean 401. Seen this exact failure.
const ANTHROPIC_API_KEY = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim()

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  try {
    const { system, messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array required" }, 400)
    }

    const callApi = () =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system,
          messages,
        }),
      })

    // A bare Cloudflare 503 (no request-id/content-type — never reached
    // Anthropic's app) has been observed on some edge PoPs. It's transient
    // per-PoP, so one retry usually lands on a healthy route.
    let res = await callApi()
    if (res.status === 503 && !res.headers.get("request-id")) {
      res = await callApi()
    }

    const raw = await res.text()
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      console.error("Anthropic returned non-JSON:", res.status, raw.slice(0, 500))
      return json({ error: `Anthropic returned an unexpected response (HTTP ${res.status}): ${raw.slice(0, 200) || '(empty body)'}` }, 502)
    }

    if (!res.ok) return json({ error: data?.error?.message ?? `API error ${res.status}` }, res.status)

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
