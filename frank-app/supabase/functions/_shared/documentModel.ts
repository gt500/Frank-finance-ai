// What a document or statement SAYS — wording, labels and formatted amounts — kept separate from how it is
// drawn (pdf.ts), so the text of a tax invoice can be tested without rendering a PDF.
import { VAT_RATE_PERCENT } from "./invoicing.js"

export interface Settings { business_name: string; address: string; vat_number: string; bank_details: string; footer_note: string }
export interface Doc {
  doc_type: "invoice" | "quote"; number: number | null; status: string
  customer_name: string; customer_email: string; customer_address: string; customer_vat: string
  issue_date: string; due_date: string; vat_enabled: boolean; notes: string
  supplier_name: string | null; supplier_address: string | null; supplier_vat: string | null
  sub_cents: number; vat_cents: number; total_cents: number; paid_cents: number
}
export interface Line { description: string; qty: number; unit_cents: number }
export interface Party { name: string; address: string; vat: string }
export interface Model {
  title: string; number: string
  supplier: Party; billTo: Party
  meta: string[][]; columns: string[]; rows: string[][]; totals: string[][]
  aging: string[][]; notes: string[]; footer: string[]
}
interface StatementIn {
  customerName: string; asOf: string; closingCents: number
  lines: { date: string; ref: string; debitCents: number; creditCents: number; balanceCents: number }[]
  aging: Record<"current" | "d1_30" | "d31_60" | "d61_90" | "d90plus", number>
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** Whole cents → "R 11 500,00" (plain spaces, so any PDF font can draw it). */
export function rand(cents: number): string {
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${cents < 0 ? "-" : ""}R ${whole},${String(abs % 100).padStart(2, "0")}`
}

/** "2026-07-01" → "1 July 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

const qtyText = (q: number) => (Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/0+$/, "").replace(".", ","))
const lines_ = (s: string | null | undefined) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean)
const label = (type: string, n: number | null) => n ? `${type === "quote" ? "QUO" : "INV"}-${String(n).padStart(4, "0")}` : "DRAFT"

export function documentModel(doc: Doc, lines: Line[], settings?: Settings): Model {
  const isQuote = doc.doc_type === "quote"
  const money = (c: number) => rand(c)
  const totals: string[][] = doc.vat_enabled
    ? [["Subtotal (excl. VAT)", money(doc.sub_cents)], [`VAT ${VAT_RATE_PERCENT}%`, money(doc.vat_cents)], [isQuote ? "Total" : "Total due", money(doc.total_cents)]]
    : [[isQuote ? "Total" : "Total due", money(doc.total_cents)]]
  if (!isQuote && doc.paid_cents > 0) totals.push(["Paid", money(doc.paid_cents)], ["Balance due", money(doc.total_cents - doc.paid_cents)])

  const notes = lines_(doc.notes)
  if (!isQuote && settings?.bank_details?.trim()) notes.push(`Banking details: ${settings.bank_details.trim()}`)

  return {
    title: isQuote ? "QUOTATION" : doc.vat_enabled ? "TAX INVOICE" : "INVOICE",
    number: label(doc.doc_type, doc.number),
    supplier: { name: doc.supplier_name ?? settings?.business_name ?? "", address: doc.supplier_address ?? settings?.address ?? "", vat: doc.supplier_vat ?? "" },
    billTo: { name: doc.customer_name, address: doc.customer_address, vat: doc.customer_vat },
    meta: [["Date", longDate(doc.issue_date)], [isQuote ? "Valid until" : "Due date", longDate(doc.due_date)]],
    columns: ["Description", "Qty", "Unit price", doc.vat_enabled ? "Amount (excl. VAT)" : "Amount"],
    rows: lines.map((l) => [l.description, qtyText(Number(l.qty)), money(l.unit_cents), money(Math.round(Number(l.qty) * l.unit_cents))]),
    totals, aging: [], notes,
    footer: settings?.footer_note?.trim() ? [settings.footer_note.trim()] : [],
  }
}

export function statementModel(s: StatementIn, billTo: Party, settings: Settings): Model {
  const a = s.aging
  return {
    title: "STATEMENT", number: "",
    supplier: { name: settings.business_name, address: settings.address, vat: settings.vat_number },
    billTo,
    meta: [["Statement date", longDate(s.asOf)]],
    columns: ["Date", "Reference", "Debit", "Credit", "Balance"],
    rows: s.lines.map((l) => [
      longDate(l.date), l.debitCents > 0 ? `Invoice ${l.ref}` : `Payment — ${l.ref}`,
      l.debitCents > 0 ? rand(l.debitCents) : "", l.creditCents > 0 ? rand(l.creditCents) : "", rand(l.balanceCents),
    ]),
    totals: [["Total due", rand(s.closingCents)]],
    aging: [["Current", rand(a.current)], ["1–30 days", rand(a.d1_30)], ["31–60 days", rand(a.d31_60)], ["61–90 days", rand(a.d61_90)], ["90+ days", rand(a.d90plus)]],
    notes: settings.bank_details.trim() ? [`Banking details: ${settings.bank_details.trim()}`] : [],
    footer: settings.footer_note.trim() ? [settings.footer_note.trim()] : [],
  }
}

/** Subject and plain-text body for the email that carries the PDF. */
export function mailText(kind: "invoice" | "quote" | "statement", m: Model, sender: string): { subject: string; text: string } {
  const total = m.totals.at(-1)?.[1] ?? ""
  const second = m.meta[1]
  const what = kind === "statement" ? "statement of account" : `${m.title.charAt(0)}${m.title.slice(1).toLowerCase()} ${m.number}`
  const subject = kind === "statement" ? `Statement of account from ${sender}` : `${what} from ${sender}`
  const facts = kind === "statement"
    ? [`Statement date: ${m.meta[0][1]}`, `Total due: ${total}`]
    : [`Total: ${total}`, ...(second ? [`${second[0]}: ${second[1]}`] : [])]
  const text = [
    `Hi ${m.billTo.name},`, "",
    `Please find attached ${kind === "statement" ? "your statement of account" : `${what.toLowerCase()}`} from ${sender}.`, "",
    ...facts, "",
    ...m.notes, ...(m.notes.length ? [""] : []),
    "Kind regards", sender,
  ].join("\n")
  return { subject, text }
}
