// Sending mail from a client's own mailbox over SMTP. SMTP is used to SEND only — the inbox is never read.
//
// The mailbox host is typed in by the client, so before connecting we make sure it is a real public
// server (never localhost, a private address or a cloud metadata address) and connect to the address
// we checked, so a DNS answer cannot change between the check and the connection.
import nodemailer from "npm:nodemailer@6.9.16"
import { Buffer } from "node:buffer"
import { isIP } from "node:net"

export type MailErrorCode = "host" | "auth" | "connect" | "rejected" | "unknown"
export class MailError extends Error {
  constructor(public code: MailErrorCode, message: string) { super(message); this.name = "MailError" }
}

export interface MailboxCfg {
  host: string                                   // what we connect to (already checked: see safeTarget)
  servername?: string                            // the name on the server's certificate
  port: number
  security: "ssl" | "starttls"
  username: string
  from_name: string
  from_email: string
  tlsOptions?: Record<string, unknown>           // tests only; the functions never set it
}
export interface Outgoing {
  to: string; subject: string; text: string
  attachments: { filename: string; content: Uint8Array; contentType: string }[]
}

// Standard submission ports only: this is mail sending, not a general-purpose connector.
export const ALLOWED_PORTS = [25, 465, 587, 2525]
export const isEmail = (s: string) => /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]{2,}$/.test(s)

function v4Private(ip: string): boolean {
  const p = ip.split(".").map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true   // unreadable: treat as unsafe
  const [a, b] = p
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))
}

/** True for any address a mailbox must never point at: loopback, private, link-local, metadata, multicast. */
export function isPrivateAddress(raw: string): boolean {
  const ip = raw.trim().toLowerCase().replace(/^\[|\]$/g, "")
  if (isIP(ip) === 4) return v4Private(ip)
  if (isIP(ip) !== 6) return true
  if (ip === "::" || ip === "::1") return true
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return v4Private(mapped[1])
  return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("ff")
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
type Resolver = (host: string) => Promise<string[]>
const dnsResolver: Resolver = async (host) => {
  const out: string[] = []
  for (const type of ["A", "AAAA"] as const) { try { out.push(...await Deno.resolveDns(host, type)) } catch { /* no records of this type */ } }
  return out
}

/** Check a typed-in mail host and return the public address to connect to. Throws MailError('host'). */
export async function safeTarget(host: string, resolve: Resolver = dnsResolver): Promise<{ ip: string; servername: string }> {
  const name = host.trim()
  const bad = (why: string) => new MailError("host", why)
  if (!HOSTNAME.test(name) || isIP(name) !== 0 || /\.(local|localdomain|internal|lan|home)$/i.test(name)) {
    return Promise.reject(bad("Enter the mail server's public name, for example smtp.gmail.com."))
  }
  const ips = await resolve(name)
  if (ips.length === 0) throw bad("We couldn't find that mail server. Check the spelling of the server name.")
  if (ips.some(isPrivateAddress)) throw bad("That server name points to a private address, so it can't be used.")
  return { ip: ips.find((i) => isIP(i) === 4) ?? ips[0], servername: name }
}

const MESSAGES: Record<Exclude<MailErrorCode, "host">, string> = {
  auth: "The mail server rejected the username or password. Gmail and Microsoft 365 need an app password, not your normal sign-in password.",
  connect: "Couldn't connect to the mail server. Check the server name, port and SSL/TLS setting.",
  rejected: "The mail server refused the message or the recipient address.",
  unknown: "Couldn't send the email. Please try again.",
}

/** Turn whatever the SMTP library threw into one plain sentence. Server wording never reaches the client. */
export function friendlyMailError(e: unknown): MailError {
  if (e instanceof MailError) return e
  const { code, responseCode } = (e ?? {}) as { code?: string; responseCode?: number }
  let kind: Exclude<MailErrorCode, "host"> = "unknown"
  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) kind = "auth"
  else if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "ETLS", "EDNS"].includes(code ?? "")) kind = "connect"
  else if (code === "EENVELOPE" || code === "EMESSAGE" || (responseCode !== undefined && responseCode >= 500 && responseCode < 600)) kind = "rejected"
  console.error("mail error:", code, responseCode, e instanceof Error ? e.message : "")   // detail stays in our logs
  return new MailError(kind, MESSAGES[kind])
}

function transport(cfg: MailboxCfg, password: string) {
  return nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.security === "ssl", requireTLS: cfg.security === "starttls",
    auth: { user: cfg.username, pass: password },
    tls: { servername: cfg.servername ?? cfg.host, ...cfg.tlsOptions },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
  })
}

/** Connect and log in without sending anything. */
export async function verifyMailbox(cfg: MailboxCfg, password: string): Promise<void> {
  const t = transport(cfg, password)
  try { await t.verify() } catch (e) { throw friendlyMailError(e) } finally { t.close() }
}

export async function sendMail(cfg: MailboxCfg, password: string, msg: Outgoing): Promise<void> {
  if (!isEmail(msg.to)) throw new MailError("rejected", "That email address doesn't look right.")
  if (/[\r\n]/.test(msg.subject)) throw new MailError("rejected", "The subject can't contain line breaks.")
  const t = transport(cfg, password)
  try {
    await t.sendMail({
      from: { name: cfg.from_name.replace(/[\r\n"]/g, " "), address: cfg.from_email },
      to: msg.to, subject: msg.subject, text: msg.text,
      attachments: msg.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })),
    })
  } catch (e) { throw friendlyMailError(e) } finally { t.close() }
}
