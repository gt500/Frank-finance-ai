import { assert, assertEquals } from "jsr:@std/assert@1"
import { handleSend, type Deps, type Store } from "./handler.ts"
import { renderPdf } from "../_shared/pdf.ts"
import { MailError } from "../_shared/mail.ts"

const settings = { business_name: "Acme Traders", address: "1 Main Rd", vat_number: "4123456789", bank_details: "Nedbank 123", footer_note: "" }
const baseDoc = {
  id: "d1", doc_type: "invoice" as const, number: 47, status: "issued", customer_name: "Durbanville Catering Co.", customer_email: "accounts@durbanvillecatering.co.za",
  customer_address: "5 Oak St", customer_vat: "", issue_date: "2026-07-01", due_date: "2026-07-15", vat_enabled: true, notes: "",
  supplier_name: "Acme Traders", supplier_address: "1 Main Rd", supplier_vat: "4123456789", sub_cents: 1000000, vat_cents: 150000, total_cents: 1150000, paid_cents: 0,
}
const mailbox = { host: "smtp.gmail.com", port: 465, security: "ssl" as const, username: "acme@gmail.com", from_name: "Acme Traders", from_email: "acme@gmail.com" }

function setup(over: Partial<Store> = {}, tenantId = "tenant-1") {
  const calls = { sent: [] as any[], logs: [] as any[], marked: [] as any[] }
  const store: Store = {
    tenantFor: async (t) => (t === "good" ? { tenantId } : null),
    sentToday: async () => 0,
    document: async (tid, id) => (tid === "tenant-1" && id === "d1" ? { ...baseDoc } : null),
    lines: async () => [{ description: "Fresh produce", qty: 4, unit_cents: 225000 }],
    settings: async () => settings,
    mailbox: async () => mailbox,
    password: async () => "app-pass",
    customerInvoices: async () => [],
    paymentsFor: async () => [],
    log: async (_t, e) => { calls.logs.push(e) },
    markSent: async (_t, id, to) => { calls.marked.push([id, to]) },
    ...over,
  }
  const deps: Deps = {
    store, render: renderPdf, today: () => "2026-08-01",
    target: async (host) => ({ ip: "142.250.1.1", servername: host }),
    send: async (cfg, pw, msg) => { calls.sent.push({ cfg, pw, msg }) },
  }
  return { deps, calls }
}
const post = (body: unknown, token = "good") => new Request("http://x", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
const read = async (r: Response) => ({ status: r.status, body: await r.json() })

Deno.test("signed-out callers are refused", async () => {
  const { deps, calls } = setup()
  assertEquals((await read(await handleSend(post({ kind: "document", document_id: "d1" }, "nope"), deps))).status, 401)
  assertEquals(calls.sent.length, 0)
})

Deno.test("sends the invoice PDF to the address ON the document, whatever the request says", async () => {
  const { deps, calls } = setup()
  const r = await read(await handleSend(post({ kind: "document", document_id: "d1", to: "attacker@evil.com", cc: "x@y.co" }), deps))
  assertEquals(r.status, 200)
  assertEquals(r.body, { ok: true, sentTo: "accounts@durbanvillecatering.co.za" })
  assertEquals(calls.sent.length, 1)
  const { cfg, pw, msg } = calls.sent[0]
  assertEquals([cfg.host, cfg.servername, pw, msg.to], ["142.250.1.1", "smtp.gmail.com", "app-pass", "accounts@durbanvillecatering.co.za"])
  assertEquals(msg.subject, "Tax invoice INV-0047 from Acme Traders")
  assertEquals(msg.attachments[0].filename, "INV-0047.pdf")
  assertEquals(new TextDecoder().decode(msg.attachments[0].content.slice(0, 5)), "%PDF-")
  assertEquals(calls.marked, [["d1", "accounts@durbanvillecatering.co.za"]])
  assertEquals(calls.logs[0], { document_id: "d1", kind: "invoice", to_email: "accounts@durbanvillecatering.co.za", status: "sent", error: null })
})

Deno.test("another client's document is simply not found", async () => {
  const { deps, calls } = setup({}, "tenant-2")
  assertEquals((await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))).status, 404)
  assertEquals(calls.sent.length, 0)
})

Deno.test("drafts and void documents are never sent", async () => {
  for (const status of ["draft", "void"]) {
    const { deps, calls } = setup({ document: async () => ({ ...baseDoc, status }) })
    assertEquals((await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))).status, 409, status)
    assertEquals(calls.sent.length, 0)
  }
})

Deno.test("a document with no valid customer email is refused with a clear message", async () => {
  const { deps, calls } = setup({ document: async () => ({ ...baseDoc, customer_email: "not-an-email" }) })
  const r = await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))
  assertEquals(r.status, 400)
  assert(r.body.error.includes("email"))
  assertEquals(calls.sent.length, 0)
})

Deno.test("the daily send cap stops further sends", async () => {
  const { deps, calls } = setup({ sentToday: async () => 100 })
  assertEquals((await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))).status, 429)
  assertEquals(calls.sent.length, 0)
})

Deno.test("no mailbox connected: asks the client to connect one, sends nothing", async () => {
  const { deps, calls } = setup({ mailbox: async () => null })
  const r = await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))
  assertEquals(r.status, 400)
  assert(r.body.error.includes("Connections"))
  assertEquals(calls.sent.length, 0)
})

Deno.test("the demo workspace never sends real mail: it is simulated and logged", async () => {
  const { deps, calls } = setup({ mailbox: async () => null, document: async () => ({ ...baseDoc }) }, "cape-fresh-grocery")
  const r = await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))
  assertEquals(r.body, { ok: true, sentTo: "accounts@durbanvillecatering.co.za", simulated: true })
  assertEquals(calls.sent.length, 0)
  assertEquals(calls.logs[0].status, "simulated")
})

Deno.test("a failed send is reported plainly, logged, and the document is not marked sent", async () => {
  const { deps, calls } = setup()
  deps.send = async () => { throw new MailError("auth", "The mail server rejected the username or password.") }
  const r = await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))
  assertEquals(r.status, 502)
  assertEquals(r.body.error, "The mail server rejected the username or password.")
  assertEquals(calls.marked.length, 0)
  assertEquals(calls.logs[0].status, "failed")
})

Deno.test("a mailbox pointing at a private address is refused before any connection", async () => {
  const { deps, calls } = setup()
  deps.target = async () => { throw new MailError("host", "That server name points to a private address, so it can't be used.") }
  assertEquals((await read(await handleSend(post({ kind: "document", document_id: "d1" }), deps))).status, 400)
  assertEquals(calls.sent.length, 0)
})

Deno.test("a statement goes to the customer's latest invoice email and shows what is owed", async () => {
  const inv = (id: string, number: number, date: string, email: string, status = "issued", total = 100000) =>
    ({ ...baseDoc, id, number, issue_date: date, due_date: date, customer_email: email, status, total_cents: total, sub_cents: total, vat_cents: 0 })
  const { deps, calls } = setup({
    customerInvoices: async () => [inv("a", 1, "2026-06-01", "old@x.co"), inv("b", 2, "2026-07-01", "new@x.co"), inv("c", 3, "2026-07-10", "void@x.co", "void")],
    paymentsFor: async () => [{ document_id: "a", amount_cents: 40000, paid_on: "2026-06-20" }],
  })
  const r = await read(await handleSend(post({ kind: "statement", customer_name: "Durbanville Catering Co." }), deps))
  assertEquals(r.body, { ok: true, sentTo: "new@x.co" })
  assertEquals(calls.sent[0].msg.subject, "Statement of account from Acme Traders")
  assert(calls.sent[0].msg.text.includes("R 1 600,00"))            // 1 000 - 400 + 1 000
  assertEquals(calls.logs[0].kind, "statement")
  assertEquals(calls.marked.length, 0)
})

Deno.test("a statement for a customer who owes nothing is not sent", async () => {
  const { deps, calls } = setup({
    customerInvoices: async () => [{ ...baseDoc, id: "a", status: "paid", paid_cents: 1150000 }],
    paymentsFor: async () => [{ document_id: "a", amount_cents: 1150000, paid_on: "2026-07-10" }],
  })
  assertEquals((await read(await handleSend(post({ kind: "statement", customer_name: "Durbanville Catering Co." }), deps))).status, 409)
  assertEquals(calls.sent.length, 0)
})

Deno.test("an unknown request kind is a bad request", async () => {
  const { deps } = setup()
  assertEquals((await read(await handleSend(post({ kind: "everything" }), deps))).status, 400)
})
