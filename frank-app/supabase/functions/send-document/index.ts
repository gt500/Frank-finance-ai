// POST { kind: "document", document_id } or { kind: "statement", customer_name }
// Emails the PDF from the client's own mailbox to the customer address stored on the document.
import { withCors } from "../_shared/cors.ts"
import { renderPdf } from "../_shared/pdf.ts"
import { safeTarget, sendMail } from "../_shared/mail.ts"
import { handleSend } from "./handler.ts"
import { supabaseStore } from "./store.ts"

// South African calendar date, so a statement printed just after midnight carries the right day.
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date())

Deno.serve(withCors((req) => handleSend(req, {
  store: supabaseStore(), render: renderPdf, send: sendMail, target: (host) => safeTarget(host), today,
})))
