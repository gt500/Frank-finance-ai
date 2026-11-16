// The real Store: service-role queries, every one scoped to the caller's tenant.
import { admin, tenantForToken } from "../_shared/tenant.ts"
import type { Store, StoredDoc, MailboxRow } from "./handler.ts"
import type { Line, Settings } from "../_shared/documentModel.ts"

const num = (v: unknown) => Number(v)
const asDoc = (r: Record<string, unknown>): StoredDoc => ({
  ...(r as unknown as StoredDoc),
  number: num(r.number), sub_cents: num(r.sub_cents), vat_cents: num(r.vat_cents), total_cents: num(r.total_cents), paid_cents: num(r.paid_cents),
})
const fail = (what: string, error: unknown): never => { console.error(`send-document: ${what} failed`, error); throw new Error(what) }

export function supabaseStore(): Store {
  const db = admin()
  return {
    tenantFor: tenantForToken,
    async sentToday(tenantId) {
      const { count, error } = await db.from("mail_log").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("status", "sent").gte("created_at", `${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
      if (error) fail("count sends", error)
      return count ?? 0
    },
    async document(tenantId, id) {
      const { data, error } = await db.from("documents").select("*").eq("id", id).eq("tenant_id", tenantId).maybeSingle()
      if (error) fail("load document", error)
      return data ? asDoc(data) : null
    },
    async lines(documentId) {
      const { data, error } = await db.from("document_lines").select("description, qty, unit_cents").eq("document_id", documentId).order("position")
      if (error) fail("load lines", error)
      return (data ?? []).map((l): Line => ({ description: l.description, qty: num(l.qty), unit_cents: num(l.unit_cents) }))
    },
    async settings(tenantId) {
      const { data, error } = await db.from("invoice_settings").select("business_name, address, vat_number, bank_details, footer_note").eq("tenant_id", tenantId).maybeSingle()
      if (error) fail("load settings", error)
      return (data as Settings | null) ?? null
    },
    async mailbox(tenantId) {
      const { data, error } = await db.from("tenant_mailboxes").select("host, port, security, username, from_name, from_email").eq("tenant_id", tenantId).maybeSingle()
      if (error) fail("load mailbox", error)
      return (data as MailboxRow | null) ?? null
    },
    async password(tenantId) {
      const { data, error } = await db.rpc("read_mailbox_secret", { p_tenant: tenantId })
      if (error) fail("read mailbox secret", error)
      return (data as string | null) ?? null
    },
    async customerInvoices(tenantId, customerName) {
      const { data, error } = await db.from("documents").select("*").eq("tenant_id", tenantId).eq("doc_type", "invoice").eq("customer_name", customerName)
      if (error) fail("load customer invoices", error)
      return (data ?? []).map(asDoc)
    },
    async paymentsFor(documentIds) {
      if (documentIds.length === 0) return []
      const { data, error } = await db.from("document_payments").select("document_id, amount_cents, paid_on").in("document_id", documentIds)
      if (error) fail("load payments", error)
      return (data ?? []).map((p) => ({ document_id: p.document_id, amount_cents: num(p.amount_cents), paid_on: p.paid_on }))
    },
    async log(tenantId, e) {
      const { error } = await db.from("mail_log").insert({ tenant_id: tenantId, ...e })
      if (error) console.error("send-document: could not write mail_log", error)   // never block or fail a send over its log row
    },
    async markSent(tenantId, documentId, to) {
      const { error } = await db.from("documents").update({ sent_at: new Date().toISOString(), last_sent_to: to }).eq("id", documentId).eq("tenant_id", tenantId)
      if (error) console.error("send-document: could not mark sent", error)
    },
  }
}
