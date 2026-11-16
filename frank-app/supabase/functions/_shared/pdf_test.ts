import { assert, assertStringIncludes } from "jsr:@std/assert@1"
import { PDFDocument } from "npm:pdf-lib@1.17.1"
import { documentModel, statementModel } from "./documentModel.ts"
import { renderPdf } from "./pdf.ts"

// One char per byte (TextDecoder's "latin1" is really Windows-1252 and would corrupt binary data).
const bytesToString = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join("")

// Inflate one stream; null if it is not a deflate stream (fonts, images, metadata).
async function inflate(body: Uint8Array<ArrayBuffer>): Promise<string | null> {
  try {
    const ds = new DecompressionStream("deflate")
    const w = ds.writable.getWriter()
    w.write(body).catch(() => {}); w.close().catch(() => {})
    return bytesToString(new Uint8Array(await new Response(ds.readable).arrayBuffer()))
  } catch { return null }
}

// Pull the drawn text back out of a finished PDF (inflate each content stream, decode the hex strings).
async function pdfText(bytes: Uint8Array): Promise<string> {
  const raw = bytesToString(bytes)
  let out = ""
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const body = Uint8Array.from(m[1], (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
    const text = await inflate(body) ?? m[1]
    for (const h of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += h[1].match(/../g)!.map((x) => String.fromCharCode(parseInt(x, 16))).join("") + "\n"
    for (const t of text.matchAll(/\(((?:\.|[^\)])*)\)\s*Tj/g)) out += t[1] + "\n"
  }
  return out
}

const settings = { business_name: "Cape Fresh Grocery", address: "1 Main Rd\nBellville", vat_number: "4123456789", bank_details: "Nedbank 1234567", footer_note: "Thank you." }
const doc = {
  doc_type: "invoice" as const, number: 47, status: "issued", customer_name: "Durbanville Catering Co.", customer_email: "a@b.co", customer_address: "5 Oak St", customer_vat: "",
  issue_date: "2026-07-01", due_date: "2026-07-15", vat_enabled: true, notes: "", supplier_name: "Cape Fresh Grocery", supplier_address: "1 Main Rd\nBellville", supplier_vat: "4123456789",
  sub_cents: 1000000, vat_cents: 150000, total_cents: 1150000, paid_cents: 0,
}

Deno.test("a tax invoice PDF is a real PDF carrying the legally relevant text", async () => {
  const bytes = await renderPdf(documentModel(doc, [{ description: "Fresh produce", qty: 4, unit_cents: 225000 }], settings))
  assert(new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
  assert((await PDFDocument.load(bytes)).getPageCount() === 1)
  const t = await pdfText(bytes)
  for (const want of ["TAX INVOICE", "INV-0047", "Cape Fresh Grocery", "4123456789", "Durbanville Catering Co.", "1 July 2026", "15 July 2026", "Fresh produce", "R 9 000,00", "R 10 000,00", "VAT 15%", "R 1 500,00", "R 11 500,00", "Nedbank 1234567"]) {
    assertStringIncludes(t, want)
  }
})

Deno.test("a long invoice flows onto more pages", async () => {
  const lines = Array.from({ length: 70 }, (_, i) => ({ description: `Item ${i + 1}`, qty: 1, unit_cents: 1000 }))
  const bytes = await renderPdf(documentModel(doc, lines, settings))
  assert((await PDFDocument.load(bytes)).getPageCount() >= 2)
  const t = await pdfText(bytes)
  assertStringIncludes(t, "Item 70")
  assertStringIncludes(t, "R 11 500,00")   // totals still printed
})

Deno.test("long descriptions wrap and unusual characters never crash the render", async () => {
  const long = "Premium organic free-range produce box ".repeat(8)
  const bytes = await renderPdf(documentModel({ ...doc, customer_name: "Café “Zoë” ☕ 😀 Ltd" }, [{ description: long, qty: 1.5, unit_cents: 1000 }], settings))
  assert(bytes.length > 1000)
  assertStringIncludes(await pdfText(bytes), "Caf")
})

Deno.test("a statement PDF shows lines, ageing and the total due", async () => {
  const s = {
    customerName: "Durbanville Catering Co.", asOf: "2026-08-01", closingCents: 310000,
    lines: [{ date: "2026-06-01", ref: "INV-0001", debitCents: 100000, creditCents: 0, balanceCents: 100000 }],
    aging: { current: 0, d1_30: 250000, d31_60: 60000, d61_90: 0, d90plus: 0 },
  }
  const t = await pdfText(await renderPdf(statementModel(s, { name: "Durbanville Catering Co.", address: "", vat: "" }, settings)))
  for (const want of ["STATEMENT", "1 August 2026", "Invoice INV-0001", "R 1 000,00", "31", "R 2 500,00", "Total due", "R 3 100,00"]) assertStringIncludes(t, want)
})
