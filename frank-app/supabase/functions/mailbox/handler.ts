// Connect or disconnect the mailbox documents are sent from. The login is verified BEFORE anything is
// stored, the password goes straight into Vault, and nothing in any response ever contains it.
import { ALLOWED_PORTS, isEmail, MailError, type MailboxCfg } from "../_shared/mail.ts"
import { DEMO_TENANTS } from "../send-document/handler.ts"

export interface SavedMailbox { host: string; port: number; security: "ssl" | "starttls"; username: string; from_name: string; from_email: string }
export interface Deps {
  tenantFor(token: string): Promise<{ tenantId: string } | null>
  target(host: string): Promise<{ ip: string; servername: string }>
  verify(cfg: MailboxCfg, password: string): Promise<void>
  save(tenantId: string, mailbox: SavedMailbox, password: string): Promise<void>
  remove(tenantId: string): Promise<void>
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const fail = (status: number, error: string) => json({ error }, status)
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export async function handleMailbox(req: Request, d: Deps): Promise<Response> {
  if (req.method !== "POST") return fail(405, "Method not allowed")
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  const who = token ? await d.tenantFor(token) : null
  if (!who) return fail(401, "Please sign in again.")

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return fail(400, "Invalid request.") }

  if (b.action === "disconnect") { await d.remove(who.tenantId); return json({ ok: true }) }
  if (b.action !== "save") return fail(400, "Invalid request.")
  if (DEMO_TENANTS.has(who.tenantId)) return fail(400, "The demo workspace can't connect a real mailbox. Documents sent from it are simulated.")

  const mailbox: SavedMailbox = {
    host: text(b.host, 253).toLowerCase(), port: Number(b.port), security: b.security as "ssl" | "starttls",
    username: text(b.username, 254), from_name: text(b.from_name, 100), from_email: text(b.from_email, 254),
  }
  const password = typeof b.password === "string" ? b.password : ""
  if (!ALLOWED_PORTS.includes(mailbox.port)) return fail(400, `Use a standard mail-sending port: ${ALLOWED_PORTS.join(", ")}.`)
  if (mailbox.security !== "ssl" && mailbox.security !== "starttls") return fail(400, "Choose SSL or TLS (STARTTLS).")
  if (!mailbox.username || !password || password.length > 200) return fail(400, "Enter the mailbox username and password.")
  if (!isEmail(mailbox.from_email)) return fail(400, "Enter the email address documents should come from.")

  try {
    const target = await d.target(mailbox.host)
    await d.verify({ ...mailbox, host: target.ip, servername: target.servername }, password)
  } catch (e) {
    return fail(400, e instanceof MailError ? e.message : "Couldn't check that mailbox. Please try again.")
  }
  await d.save(who.tenantId, mailbox, password)
  return json({ ok: true })
}
