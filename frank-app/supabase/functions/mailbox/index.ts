// POST { action: "save", host, port, security, username, password, from_name, from_email } | { action: "disconnect" }
import { withCors } from "../_shared/cors.ts"
import { safeTarget, verifyMailbox } from "../_shared/mail.ts"
import { admin, tenantForToken } from "../_shared/tenant.ts"
import { handleMailbox } from "./handler.ts"

const db = admin()

Deno.serve(withCors((req) => handleMailbox(req, {
  tenantFor: tenantForToken,
  target: (host) => safeTarget(host),
  verify: verifyMailbox,
  async save(tenantId, mailbox, password) {
    const { data: secretId, error: sErr } = await db.rpc("store_mailbox_secret", { p_tenant: tenantId, p_password: password })
    if (sErr || !secretId) { console.error("mailbox: store secret failed", sErr); throw new Error("Could not store the mailbox password") }
    const { error } = await db.from("tenant_mailboxes").upsert({
      tenant_id: tenantId, ...mailbox, secret_id: secretId, verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    if (error) { console.error("mailbox: save failed", error); throw new Error("Could not save the mailbox") }
  },
  async remove(tenantId) {
    const { error } = await db.rpc("delete_mailbox", { p_tenant: tenantId })
    if (error) { console.error("mailbox: delete failed", error); throw new Error("Could not disconnect the mailbox") }
  },
})))
