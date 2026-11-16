// Run with:  deno test --allow-net --allow-read supabase/functions/_shared
import { assertEquals, assertStringIncludes, assert } from "jsr:@std/assert@1"
import { documentModel, statementModel, mailText, rand, longDate } from "./documentModel.ts"

const settings = { business_name: "Cape Fresh Grocery", address: "1 Main Rd\nBellville", vat_number: "4123456789", bank_details: "Nedbank 1234567 · Branch 198765", footer_note: "Thank you for your business." }
const invoice = {
  doc_type: "invoice" as const, number: 47, status: "issued", customer_name: "Durbanville Catering Co.", customer_email: "accounts@durbanvillecatering.co.za",
  customer_address: "5 Oak St\nDurbanville", customer_vat: "4987654321", issue_date: "2026-07-01", due_date: "2026-07-15", vat_enabled: true, notes: "Deliver to the back door.",
  supplier_name: "Cape Fresh Grocery", supplier_address: "1 Main Rd\nBellville", supplier_vat: "4123456789",
  sub_cents: 1000000, vat_cents: 150000, total_cents: 1150000, paid_cents: 0,
}
const lines = [{ description: "Fresh produce", qty: 4, unit_cents: 225000 }, { description: "Delivery", qty: 4, unit_cents: 25000 }]

Deno.test("rand formats South African style with plain spaces", () => {
  assertEquals(rand(1150000), "R 11 500,00")
  assertEquals(rand(5), "R 0,05")
  assertEquals(rand(-250000), "-R 2 500,00")
})

Deno.test("longDate reads like a person writes it", () => assertEquals(longDate("2026-07-01"), "1 July 2026"))

Deno.test("a VAT invoice is titled TAX INVOICE and carries the supplier VAT number, sequential number and totals", () => {
  const m = documentModel(invoice, lines)
  assertEquals(m.title, "TAX INVOICE")
  assertEquals(m.number, "INV-0047")
  assertEquals(m.supplier.vat, "4123456789")
  assertEquals(m.meta, [["Date", "1 July 2026"], ["Due date", "15 July 2026"]])
  assertEquals(m.rows[0], ["Fresh produce", "4", "R 2 250,00", "R 9 000,00"])
  assertEquals(m.totals, [["Subtotal (excl. VAT)", "R 10 000,00"], ["VAT 15%", "R 1 500,00"], ["Total due", "R 11 500,00"]])
  assertEquals(m.columns[3], "Amount (excl. VAT)")
})

Deno.test("a non-VAT invoice is just INVOICE with no VAT line", () => {
  const m = documentModel({ ...invoice, vat_enabled: false, vat_cents: 0, total_cents: 1000000, supplier_vat: "" }, lines)
  assertEquals(m.title, "INVOICE")
  assertEquals(m.totals, [["Total due", "R 10 000,00"]])
  assertEquals(m.columns[3], "Amount")
})

Deno.test("a quote says QUOTATION and valid until, and is not 'due'", () => {
  const m = documentModel({ ...invoice, doc_type: "quote", number: 3 }, lines)
  assertEquals(m.title, "QUOTATION")
  assertEquals(m.number, "QUO-0003")
  assertEquals(m.meta[1], ["Valid until", "15 July 2026"])
  assertEquals(m.totals[2][0], "Total")
})

Deno.test("part payments show paid and balance due", () => {
  const m = documentModel({ ...invoice, paid_cents: 400000 }, lines)
  assertEquals(m.totals.slice(-2), [["Paid", "R 4 000,00"], ["Balance due", "R 7 500,00"]])
})

Deno.test("banking details, notes and footer come through", () => {
  const m = documentModel(invoice, lines, settings)
  assertStringIncludes(m.notes.join("\n"), "Deliver to the back door.")
  assertStringIncludes(m.notes.join("\n"), "Nedbank 1234567")
  assertEquals(m.footer, ["Thank you for your business."])
})

Deno.test("fractional quantities show up to three decimals with a comma", () => {
  assertEquals(documentModel(invoice, [{ description: "Rice", qty: 1.5, unit_cents: 1000 }]).rows[0][1], "1,5")
})

Deno.test("statement model: lines, ageing and total due", () => {
  const s = {
    customerName: "Durbanville Catering Co.", asOf: "2026-08-01", closingCents: 310000,
    lines: [{ date: "2026-06-01", ref: "INV-0001", debitCents: 100000, creditCents: 0, balanceCents: 100000 }, { date: "2026-06-20", ref: "INV-0001", debitCents: 0, creditCents: 40000, balanceCents: 60000 }],
    aging: { current: 0, d1_30: 250000, d31_60: 60000, d61_90: 0, d90plus: 0 },
  }
  const m = statementModel(s, { name: "Durbanville Catering Co.", address: "5 Oak St", vat: "" }, settings)
  assertEquals(m.title, "STATEMENT")
  assertEquals(m.meta, [["Statement date", "1 August 2026"]])
  assertEquals(m.rows[1], ["20 June 2026", "Payment — INV-0001", "", "R 400,00", "R 600,00"])
  assertEquals(m.rows[0], ["1 June 2026", "Invoice INV-0001", "R 1 000,00", "", "R 1 000,00"])
  assertEquals(m.totals.at(-1), ["Total due", "R 3 100,00"])
  assertEquals(m.aging[1], ["1–30 days", "R 2 500,00"])
})

Deno.test("email text names the document, amount, due date and sender", () => {
  const t = mailText("invoice", documentModel(invoice, lines, settings), "Cape Fresh Grocery")
  assertEquals(t.subject, "Tax invoice INV-0047 from Cape Fresh Grocery")
  assertStringIncludes(t.text, "R 11 500,00")
  assertStringIncludes(t.text, "15 July 2026")
  assertStringIncludes(t.text, "Nedbank 1234567")
  assert(!t.text.includes("undefined"))
})

Deno.test("an unissued draft is labelled DRAFT instead of a number", () => {
  assertEquals(documentModel({ ...invoice, number: null, status: "draft" }, lines).number, "DRAFT")
})
