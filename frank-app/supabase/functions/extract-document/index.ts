// Replaces the direct browser -> api.anthropic.com call in
// extractFromDocument (useFrank.js). Same auth requirement as chat-message.
import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders, withCors } from "../_shared/cors.ts"
import { relayAnthropic } from "../_shared/anthropic.ts"

// 20 MB file → ~27 MB as base64 in JSON. Text inputs are trimmed to 8k chars by the client.
const MAX_BODY_CHARS = 30_000_000, MAX_TEXT_CHARS = 20_000, MAX_BLOCKS = 4
const BLOCK_TYPES = new Set(["text", "image", "document"])
// The client sends either the prompt+text as one string, or a few content blocks (prompt + file).
function isValidContent(c: unknown): boolean {
  if (typeof c === "string") return c.length > 0 && c.length <= MAX_TEXT_CHARS
  return Array.isArray(c) && c.length > 0 && c.length <= MAX_BLOCKS &&
    c.every((b) => BLOCK_TYPES.has(b?.type) && (b.type !== "text" || (typeof b.text === "string" && b.text.length <= MAX_TEXT_CHARS)))
}

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
    // messageContent is whatever useFrank.js already built (string, or the
    // Anthropic content-block array for images/PDFs) — this function is a
    // pure pass-through proxy, not a re-implementation of the prompt logic.
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_CHARS) return json({ error: "File too large — maximum is 20 MB." }, 413)
    const raw = await req.text()
    if (raw.length > MAX_BODY_CHARS) return json({ error: "File too large — maximum is 20 MB." }, 413)
    let body
    try { body = JSON.parse(raw) } catch { return json({ error: "Invalid request." }, 400) }
    const messageContent = body?.messageContent
    if (!isValidContent(messageContent)) return json({ error: "Unsupported document content." }, 400)

    const callApi = () =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8192,
          messages: [{ role: "user", content: messageContent }],
        }),
      })

    // No server-side sleep on 429: the browser times out at 30s anyway, and a sleeping
    // worker is wasted capacity. relayAnthropic tells the user to retry in a minute.
    let res = await callApi()
    if (res.status === 503 && !res.headers.get("request-id")) {
      // A bare Cloudflare 503 (no request-id — never reached Anthropic's
      // app) has been observed on some edge PoPs. It's transient per-PoP,
      // so one retry usually lands on a healthy route.
      res = await callApi()
    }

    return await relayAnthropic(res)
  } catch (err) {
    console.error(err)
    return json({ error: "Zeeder couldn't read this document right now — please try again." }, 500)
  }
}))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}
