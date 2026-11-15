// Replaces the direct browser -> api.anthropic.com call in useFrank.js.
// Requires a Supabase Auth session so this can't be hammered anonymously.
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders, withCors } from "../_shared/cors.ts"
import { relayAnthropic } from "../_shared/anthropic.ts"

const MAX_BODY_CHARS = 200_000, MAX_SYSTEM_CHARS = 20_000, MAX_MESSAGE_CHARS = 8_000, MAX_MESSAGES = 20

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// .trim() defensively — a stray trailing newline/space from copy-pasting the
// secret in produces a malformed x-api-key header and a confusing non-JSON
// 503 from Anthropic's edge instead of a clean 401. Seen this exact failure.
const ANTHROPIC_API_KEY = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim()

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return json({ error: "Missing Authorization header" }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401)

  const { checkEntitlement } = await import("../_shared/entitlement.ts")
  const ent = await checkEntitlement(userData.user.id)
  if (!ent.ok) return json({ error: ent.reason }, 402)

  try {
    // Caps keep this a finance assistant, not a free general-purpose LLM proxy.
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_CHARS) return json({ error: "Message too long." }, 413)
    const raw = await req.text()
    if (raw.length > MAX_BODY_CHARS) return json({ error: "Message too long." }, 413)
    let body
    try { body = JSON.parse(raw) } catch { return json({ error: "Invalid request." }, 400) }
    const { system, messages } = body ?? {}
    if (!Array.isArray(messages) || messages.length === 0) return json({ error: "messages array required" }, 400)
    if (system != null && (typeof system !== "string" || system.length > MAX_SYSTEM_CHARS)) return json({ error: "Invalid request." }, 400)
    const msgs = messages.slice(-MAX_MESSAGES)
    const valid = msgs.every((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.length <= MAX_MESSAGE_CHARS)
    if (!valid) return json({ error: "Message too long or malformed." }, 400)

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
          messages: msgs,
        }),
      })

    // A bare Cloudflare 503 (no request-id/content-type — never reached
    // Anthropic's app) has been observed on some edge PoPs. It's transient
    // per-PoP, so one retry usually lands on a healthy route.
    let res = await callApi()
    if (res.status === 503 && !res.headers.get("request-id")) {
      res = await callApi()
    }

    return await relayAnthropic(res)
  } catch (err) {
    console.error(err)
    return json({ error: "Zeeder AI couldn't answer right now — please try again." }, 500)
  }
}))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
