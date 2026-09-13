import { useState } from 'react'
import { C, fmt } from '../../lib/theme'
import { useTenant } from '../../context/TenantContext'
import { ZEEDER_COMPANY } from '../../data/company'
import { buildInvoices, buildStatement } from '../../lib/invoice'
import { buildStatementCsv, downloadCsv } from '../../lib/exportCsv'

function formatDate(iso) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Section({ title, subtitle, children, right }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.card }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  )
}

// Deliberately light/white, not the app's dark CI — this is the one
// component meant to be printed or saved as a PDF and handed to someone
// outside the app, so it follows normal printed-invoice conventions.
function TaxInvoice({ tenant, invoice }) {
  return (
    <div className="invoice-print-area" style={{ background: '#fff', color: '#1a1a1a', borderRadius: 8, padding: '32px 36px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #196e95', paddingBottom: 18, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#196e95', letterSpacing: 0.5 }}>{ZEEDER_COMPANY.name}</div>
          {ZEEDER_COMPANY.addressLines.map(line => (
            <div key={line} style={{ fontSize: 12, color: '#555' }}>{line}</div>
          ))}
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Reg No: {ZEEDER_COMPANY.regNo} · VAT No: {ZEEDER_COMPANY.vatNo}</div>
          <div style={{ fontSize: 12, color: '#555' }}>{ZEEDER_COMPANY.email} · {ZEEDER_COMPANY.phone}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: '#1a1a1a' }}>TAX INVOICE</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>Invoice No: <strong>{invoice.invoiceNumber}</strong></div>
          <div style={{ fontSize: 12, color: '#555' }}>Issue Date: {formatDate(invoice.issueDate)}</div>
          <div style={{ fontSize: 12, color: '#555' }}>Due Date: {formatDate(invoice.dueDate)}</div>
          <div style={{
            marginTop: 8, display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: invoice.status === 'paid' ? '#e6f7ee' : '#fff4e0',
            color: invoice.status === 'paid' ? '#1a7a4c' : '#a15c00',
          }}>{invoice.status === 'paid' ? 'PAID' : 'PAYMENT DUE'}</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Bill To</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{tenant.name}</div>
        <div style={{ fontSize: 12, color: '#555' }}>{tenant.owner}</div>
        {tenant.location && <div style={{ fontSize: 12, color: '#555' }}>{tenant.location}</div>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Description</th>
            <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Unit Price</th>
            <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((li, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px 0', fontSize: 13 }}>{li.description}</td>
              <td style={{ padding: '10px 0', fontSize: 13, textAlign: 'right' }}>{li.qty}</td>
              <td style={{ padding: '10px 0', fontSize: 13, textAlign: 'right' }}>{fmt(li.unitPrice)}</td>
              <td style={{ padding: '10px 0', fontSize: 13, textAlign: 'right' }}>{fmt(li.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
            <span style={{ color: '#555' }}>Subtotal (excl. VAT)</span><span>{fmt(invoice.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
            <span style={{ color: '#555' }}>VAT ({(invoice.vatRate * 100).toFixed(0)}%)</span><span>{fmt(invoice.vat)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #1a1a1a', marginTop: 6, fontSize: 15, fontWeight: 800 }}>
            <span>Total (incl. VAT)</span><span>{fmt(invoice.total)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee' }}>
        <div style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Payment Details</div>
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
          {ZEEDER_COMPANY.bank.name} · Account Name: {ZEEDER_COMPANY.bank.accountName}<br />
          Account No: {ZEEDER_COMPANY.bank.accountNumber} · Branch Code: {ZEEDER_COMPANY.bank.branchCode} · SWIFT: {ZEEDER_COMPANY.bank.swift}<br />
          Reference: {invoice.invoiceNumber}
        </div>
      </div>
    </div>
  )
}

export function Billing() {
  const { tenant, data } = useTenant()
  const invoices = buildInvoices(tenant, data.MONTHLY)
  const { rows, balanceDue } = buildStatement(invoices)
  const [selectedIdx, setSelectedIdx] = useState(invoices.length - 1)
  const invoice = invoices[selectedIdx]

  return (
    <div className="fade-up" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>

      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Billing & Invoices</div>
        <div style={{ fontSize: 13, color: C.sub }}>Tax invoices and your statement of account for your Zeeder Finance OS subscription.</div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, background: '#0a1828' }}>

        <Section
          title="Tax Invoice"
          subtitle="Issued by Zeeder (Pty) Ltd for your monthly subscription"
          right={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                value={selectedIdx}
                onChange={e => setSelectedIdx(Number(e.target.value))}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                {invoices.map((inv, i) => (
                  <option key={inv.invoiceNumber} value={i}>{inv.period.m} {inv.period.y} — {inv.invoiceNumber}</option>
                ))}
              </select>
              <button
                onClick={() => window.print()}
                style={{ padding: '7px 14px', borderRadius: 4, border: `1px solid ${C.frank}30`, background: C.frankDim, color: C.frank, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                Print / Save as PDF
              </button>
            </div>
          }>
          <TaxInvoice tenant={tenant} invoice={invoice} />
        </Section>

        <Section
          title="Statement of Account"
          subtitle={`Full billing history · Balance due: ${fmt(balanceDue)}`}
          right={
            <button
              onClick={() => downloadCsv(`statement_${tenant.id}.csv`, buildStatementCsv(rows))}
              style={{ padding: '6px 12px', borderRadius: 4, border: `1px solid ${C.frank}30`, background: C.frankDim, color: C.frank, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
              Export CSV
            </button>
          }>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Invoice', 'Issue Date', 'Due Date', 'Total', 'Status', 'Balance'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Total' || h === 'Balance' ? 'right' : 'left', padding: '8px 10px', fontSize: 10, color: C.dim, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.invoiceNumber} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px', fontSize: 12, color: C.text, fontFamily: 'var(--mono)' }}>{r.invoiceNumber}</td>
                    <td style={{ padding: '10px', fontSize: 12, color: C.sub }}>{formatDate(r.issueDate)}</td>
                    <td style={{ padding: '10px', fontSize: 12, color: C.sub }}>{formatDate(r.dueDate)}</td>
                    <td style={{ padding: '10px', fontSize: 12, color: C.text, textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(r.total)}</td>
                    <td style={{ padding: '10px', fontSize: 11 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 3, fontWeight: 700,
                        background: r.status === 'paid' ? `${C.frank}15` : `${C.warn}15`,
                        color: r.status === 'paid' ? C.frank : C.warn,
                      }}>{r.status === 'paid' ? 'Paid' : 'Due'}</span>
                    </td>
                    <td style={{ padding: '10px', fontSize: 12, color: C.text, textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

      </div>
    </div>
  )
}
