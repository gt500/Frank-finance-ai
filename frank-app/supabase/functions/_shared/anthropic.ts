import { corsHeaders } from "./cors.ts"

// Turns an Anthropic response into what the browser may see: the result on success,
// otherwise a plain message. Raw upstream bodies and error text stay in the logs only.
export async function relayAnthropic(res: Response): Promise<Response> {
  const raw = await res.text()
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    console.error("Anthropic returned non-JSON:", res.status, raw.slice(0, 500))
    return reply({ error: "Zeeder AI is temporarily unavailable — please try again." }, 502)
  }
  if (res.ok) return reply(data, 200)
  console.error("Anthropic error:", res.status, data?.error)
  if (res.status === 429 || res.status === 529) return reply({ error: "Zeeder AI is busy right now — please try again in a minute." }, 429)
  if (res.status === 413 || data?.error?.message?.includes("too long")) return reply({ error: "That is too much for Zeeder to read in one go — try a shorter document or question." }, 413)
  return reply({ error: "Zeeder AI couldn't answer right now — please try again." }, 502)
}

function reply(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } })
}
