// Draws a document Model (see documentModel.ts) as an A4 PDF. Standard Helvetica only, so no font files
// are shipped; characters it cannot draw are replaced with "?" rather than failing the send.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "npm:pdf-lib@1.17.1"
import type { Model, Party } from "./documentModel.ts"

const W = 595.28, H = 841.89, M = 48, RIGHT = W - M, BOTTOM = 64
const INK = rgb(0.09, 0.11, 0.14), MUTED = rgb(0.38, 0.42, 0.48), RULE = rgb(0.82, 0.84, 0.87), ACCENT = rgb(0.04, 0.55, 0.65)

export async function renderPdf(m: Model): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const okChars = new Map<string, boolean>()
  const clean = (s: string) => [...s.replace(/[   ]/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')].map((ch) => {
    let ok = okChars.get(ch)
    if (ok === undefined) { try { regular.encodeText(ch); ok = true } catch { ok = false } okChars.set(ch, ok) }
    return ok ? ch : "?"
  }).join("")

  let page: PDFPage = pdf.addPage([W, H])
  let y = H - M

  const width = (s: string, f: PDFFont, size: number) => f.widthOfTextAtSize(clean(s), size)
  const draw = (s: string, x: number, size = 10, f = regular, color = INK, align: "left" | "right" = "left") => {
    const t = clean(s)
    page.drawText(t, { x: align === "right" ? x - f.widthOfTextAtSize(t, size) : x, y, size, font: f, color })
  }
  const wrap = (s: string, f: PDFFont, size: number, maxW: number): string[] => {
    const out: string[] = []
    for (const para of clean(s).split("\n")) {
      let line = ""
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word
        if (f.widthOfTextAtSize(next, size) <= maxW) { line = next; continue }
        if (line) out.push(line)
        line = word
        while (f.widthOfTextAtSize(line, size) > maxW) {                 // a single over-long word
          let cut = line.length
          while (cut > 1 && f.widthOfTextAtSize(line.slice(0, cut), size) > maxW) cut--
          out.push(line.slice(0, cut)); line = line.slice(cut)
        }
      }
      out.push(line)
    }
    return out
  }
  const need = (h: number) => { if (y - h < BOTTOM) { page = pdf.addPage([W, H]); y = H - M } }
  const rule = (at = y) => page.drawLine({ start: { x: M, y: at }, end: { x: RIGHT, y: at }, thickness: 0.6, color: RULE })

  // ── Header: supplier on the left, title and numbers on the right ──
  const top = y
  draw(m.supplier.name, M, 16, bold); y -= 15
  for (const l of m.supplier.address.split("\n").map((s) => s.trim()).filter(Boolean)) { draw(l, M, 9, regular, MUTED); y -= 12 }
  if (m.supplier.vat) { draw(`VAT No: ${m.supplier.vat}`, M, 9, regular, MUTED); y -= 12 }
  const leftBottom = y
  y = top
  draw(m.title, RIGHT, 20, bold, ACCENT, "right"); y -= 18
  if (m.number) { draw(m.number, RIGHT, 12, bold, INK, "right"); y -= 15 }
  for (const [k, v] of m.meta) { draw(`${k}: ${v}`, RIGHT, 9, regular, MUTED, "right"); y -= 12 }
  y = Math.min(y, leftBottom) - 18

  // ── Bill to ──
  const party = (label: string, p: Party) => {
    draw(label, M, 8, bold, MUTED); y -= 13
    draw(p.name, M, 11, bold); y -= 13
    for (const l of p.address.split("\n").map((s) => s.trim()).filter(Boolean)) { draw(l, M, 9, regular, MUTED); y -= 12 }
    if (p.vat) { draw(`VAT No: ${p.vat}`, M, 9, regular, MUTED); y -= 12 }
  }
  party(m.number ? "BILL TO" : "STATEMENT FOR", m.billTo)
  y -= 14

  // ── Table: first column(s) left-aligned and wide, the rest right-aligned ──
  const widths = m.columns.length === 5 ? [105, 170, 70, 70, 84] : [262, 50, 90, 97]
  const leftCols = m.columns.length === 5 ? 2 : 1
  const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0))
  const header = () => {
    need(30)
    m.columns.forEach((c, i) => i < leftCols ? draw(c, xs[i], 8, bold, MUTED) : draw(c, xs[i] + widths[i] - 4, 8, bold, MUTED, "right"))
    y -= 6; rule(); y -= 14
  }
  header()
  for (const row of m.rows) {
    const cell0 = wrap(row[0], regular, 9.5, widths[0] - 8)
    need(cell0.length * 12 + 6)
    if (y === H - M) header()                                    // new page: repeat the column titles
    const rowTop = y
    cell0.forEach((l, i) => { y = rowTop - i * 12; draw(l, xs[0], 9.5) })
    y = rowTop
    row.slice(1).forEach((c, i) => {
      const col = i + 1
      if (col < leftCols) draw(c, xs[col], 9.5)
      else draw(c, xs[col] + widths[col] - 4, 9.5, regular, INK, "right")
    })
    y = rowTop - cell0.length * 12 - 4
    rule(y + 8)
  }
  y -= 10

  // ── Totals: right-aligned block, last line emphasised ──
  need(m.totals.length * 16 + 8)
  m.totals.forEach(([k, v], i) => {
    const strong = i === m.totals.length - 1 || k === "Balance due"
    draw(k, RIGHT - 120, strong ? 11 : 9.5, strong ? bold : regular, strong ? INK : MUTED, "right")
    draw(v, RIGHT - 4, strong ? 11 : 9.5, strong ? bold : regular, INK, "right")
    y -= 16
  })

  // ── Ageing (statements) ──
  if (m.aging.length) {
    y -= 8; need(60)
    draw("AGEING OF THE AMOUNT DUE", M, 8, bold, MUTED); y -= 14
    const cw = (RIGHT - M) / m.aging.length
    m.aging.forEach(([k], i) => draw(k, M + cw * i + cw - 4, 8, regular, MUTED, "right"))
    y -= 13
    m.aging.forEach(([, v], i) => draw(v, M + cw * i + cw - 4, 9.5, bold, INK, "right"))
    y -= 18
  }

  // ── Notes and footer ──
  const block = (lines: string[], size: number, color = INK) => {
    for (const para of lines) for (const l of wrap(para, regular, size, RIGHT - M)) { need(14); draw(l, M, size, regular, color); y -= size + 4 }
  }
  if (m.notes.length) { y -= 8; block(m.notes, 9) }
  if (m.footer.length) { y -= 6; block(m.footer, 8.5, MUTED) }

  return await pdf.save()
}
