// Plain CSV export — a single signed "Amount" column (positive = money in,
// negative = money out) matches the simplest bank-transaction CSV import
// shape accepted by Xero, QuickBooks Online, and Sage, so one format
// covers all three without building platform-specific templates.

import { mapCategory, accountFor } from '../data/chartOfAccounts.js'

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) lines.push(row.map(csvEscape).join(','))
  return lines.join('\r\n')
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function buildTransactionsCsv(bankData, categoryMap = {}) {
  const headers = ['Date', 'Description', 'Entity', 'Category', 'Account Code', 'Account', 'Amount']
  const withAccount = t => {
    const code = mapCategory(t.category, categoryMap)
    const account = accountFor(code)
    return [t.date, t.description, t.entityName, t.category, account.code, account.name]
  }
  const rows = [
    ...bankData.credits.map(t => [...withAccount(t), t.amount]),
    ...bankData.debits.map(t => [...withAccount(t), -t.amount]),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  return toCsv(headers, rows)
}

export function buildDebtorsCsv(debtors) {
  const headers = ['Name', 'Reference', 'Amount', 'Due Date', 'Days Overdue']
  const rows = debtors.map(d => [
    d.name ?? d.child_name ?? '',
    d.reference ?? d.ref ?? '',
    d.amount ?? d.outstanding ?? 0,
    d.due_date ?? d.due ?? '',
    d.days_overdue ?? d.daysOverdue ?? 0,
  ])
  return toCsv(headers, rows)
}

export function buildCreditorsCsv(creditors) {
  const headers = ['Supplier', 'Reference', 'Amount', 'Due Date', 'Overdue']
  const rows = creditors.map(c => [
    c.name ?? c.supplier ?? '',
    c.ref ?? c.reference ?? '',
    c.amount ?? 0,
    c.due ?? c.due_date ?? '',
    c.overdue ? 'Yes' : 'No',
  ])
  return toCsv(headers, rows)
}
