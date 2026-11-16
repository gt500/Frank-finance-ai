// The rules for emailing an invoice, quote or customer statement. Kept free of Supabase calls (they come in
// through `Store`) so the security-critical decisions are tested directly:
//   - the tenant comes from the caller's session, never from the request
//   - the recipient is the address stored on the document, never one supplied in the request
//   - drafts and void documents are never sent; the daily cap holds; the demo workspace never sends real mail
import { buildStatement } from "../_shared/invoicing.js"
import { documentModel, statementModel, mailText, type Doc, type Line, type Model, type Settings } from "../_shared/documentModel.ts"
import { isEmail, MailError, type MailboxCfg, type Outgoing } from "../_shared/mail.ts"

export const DAILY_SEND_CAP = 100
// Demo workspaces show the whole flow without emailing anyone.
export const DEMO_TENANTS = new Set(["cape-fresh-grocery"])
const SENDABLE = new Set(["issued", "paid", "converted"])

export type StoredDoc = Doc & { id: string }
export type MailboxRow = Pick<MailboxCfg, "host" | "port" | "security" | "username" | "from_name" | "from_email">
export interface LogEntry { document_id: string | null; kind: "invoice" | "quote" | "statement"; to_email: string; status: "sent" | "failed" | "simulated"; error: string | null }

export interface Store {
  tenantFor(token: string): Promise<{ tenantId: string } | null>
  sentToday(tenantId: string): Promise<number>
  document(tenantId: string, id: string): Promise<StoredDoc | null>
  lines(documentId: string): Promise<Line[]>
  settings(tenantId: string): Promise<Settings | null>
  mailbox(tenantId: string): Promise<MailboxRow | null>
  password(tenantId: string): Promise<string | null>
  customerInvoices(tenantId: string, customerName: string): Promise<StoredDoc[]>
  paymentsFor(documentIds: string[]): Promise<{ document_id: string; amount_cents: number; paid_on: string }[]>
  log(tenantId: string, entry: LogEntry): Promise<void>
  markSent(tenantId: string, documentId: string, to: string): Promise<void>
}
export interface Deps {
  store: Store
  render(model: Model): Promise<Uint8Array>
  send(cfg: MailboxCfg, password: string, msg: Outgoing): Promise<void>
  target(host: string): Promise<{ ip: string; servername: string }>
  today(): string
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const fail = (status: number, error: string) => json({ error }, status)
const label = (type: string, n: number) => `${type === "quote" ? "QUO" : "INV"}-${String(n).padStart(4, "0")}`

interface Prepared { kind: "invoice" | "quote" | "statement"; to: string; model: Model; filename: string; documentId: string | null }

export async function handleSend(req: Request, d: Deps): Promise<Response> {
  if (req.method !== "POST") return fail(405, "Method not allowed")
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  const who = token ? await d.store.tenantFor(token) : null
  if (!who) return fail(401, "Please sign in again.")
  const { tenantId } = who

  let body: { kind?: string; document_id?: string; customer_name?: string }
  try { body = await req.json() } catch { return fail(400, "Invalid request.") }
  if (body.kind !== "document" && body.kind !== "statement") return fail(400, "Invalid request.")

  if (await d.store.sentToday(tenantId) >= DAILY_SEND_CAP) return fail(429, "You've reached today's sending limit. It resets at midnight (UTC).")
  const settings = await d.store.settings(tenantId)
  if (!settings || !settings.business_name.trim()) return fail(400, "Add your business details under Connections before sending documents.")

  const prepared = body.kind === "document" ? await prepareDocument(d, tenantId, String(body.document_id ?? ""), settings)
    : await prepareStatement(d, tenantId, String(body.customer_name ?? ""), settings)
  if (prepared instanceof Response) return prepared

  const pdf = await d.render(prepared.model)
  const sender = settings.business_name
  const { subject, text } = mailText(prepared.kind, prepared.model, sender)
  const entry = { document_id: prepared.documentId, kind: prepared.kind, to_email: prepared.to }

  if (DEMO_TENANTS.has(tenantId)) {
    await d.store.log(tenantId, { ...entry, status: "simulated", error: null })
    return json({ ok: true, sentTo: prepared.to, simulated: true })
  }

  const mailbox = await d.store.mailbox(tenantId)
  const password = mailbox ? await d.store.password(tenantId) : null
  if (!mailbox || !password) return fail(400, "Connect your mailbox under Connections before sending.")

  try {
    const target = await d.target(mailbox.host)
    await d.send({ ...mailbox, host: target.ip, servername: target.servername, from_name: mailbox.from_name || sender }, password, {
      to: prepared.to, subject, text, attachments: [{ filename: prepared.filename, content: pdf, contentType: "application/pdf" }],
    })
  } catch (e) {
    const err = e instanceof MailError ? e : new MailError("unknown", "Couldn't send the email. Please try again.")
    await d.store.log(tenantId, { ...entry, status: "failed", error: err.message })
    return fail(err.code === "host" ? 400 : 502, err.message)
  }
  await d.store.log(tenantId, { ...entry, status: "sent", error: null })
  if (prepared.documentId) await d.store.markSent(tenantId, prepared.documentId, prepared.to)
  return json({ ok: true, sentTo: prepared.to })
}

async function prepareDocument(d: Deps, tenantId: string, id: string, settings: Settings): Promise<Prepared | Response> {
  const doc = id ? await d.store.document(tenantId, id) : null
  if (!doc) return fail(404, "Document not found.")
  if (!SENDABLE.has(doc.status)) return fail(409, "Only an issued document can be sent.")
  if (!isEmail(doc.customer_email)) return fail(400, "This document has no valid customer email address. Add one and try again.")
  const model = documentModel(doc, await d.store.lines(doc.id), settings)
  return { kind: doc.doc_type, to: doc.customer_email, model, filename: `${model.number}.pdf`, documentId: doc.id }
}

async function prepareStatement(d: Deps, tenantId: string, customerName: string, settings: Settings): Promise<Prepared | Response> {
  const all = customerName ? await d.store.customerInvoices(tenantId, customerName) : []
  const live = all.filter((i) => i.status !== "void" && i.status !== "draft")
  if (live.length === 0) return fail(404, "No invoices found for that customer.")
  const payments = await d.store.paymentsFor(live.map((i) => i.id))
  const numberOf = new Map(live.map((i) => [i.id, label(i.doc_type, i.number ?? 0)]))
  const asOf = d.today()
  const statement = buildStatement({
    customerName, asOf,
    invoices: live.map((i) => ({ number: numberOf.get(i.id)!, date: i.issue_date, dueDate: i.due_date, totalCents: i.total_cents, status: i.status })),
    payments: payments.map((p) => ({ invoiceNumber: numberOf.get(p.document_id)!, date: p.paid_on, amountCents: p.amount_cents })),
  })
  if (statement.closingCents <= 0) return fail(409, "This customer owes nothing, so there is no statement to send.")
  const latest = [...live].sort((a, b) => b.issue_date.localeCompare(a.issue_date) || (b.number ?? 0) - (a.number ?? 0))[0]
  if (!isEmail(latest.customer_email)) return fail(400, "This customer has no valid email address on their latest invoice.")
  const model = statementModel(statement, { name: customerName, address: latest.customer_address, vat: latest.customer_vat }, settings)
  return { kind: "statement", to: latest.customer_email, model, filename: `Statement-${asOf}.pdf`, documentId: null }
}
