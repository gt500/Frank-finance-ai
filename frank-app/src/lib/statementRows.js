// What is printed on each statement: rows of text with formatted amounts, built from buildStatements().
// Row types: heading, subheading, line, total, grand. Negative amounts go in brackets, zero is a dash.
import { rand } from './documentModel'
import { longDate, shiftDays } from './periods'

export const money = (cents) => (cents === 0 ? '–' : cents < 0 ? `(${rand(-cents)})` : rand(cents))

const row = (type, label, values = []) => ({ type, label, values })
const pctText = (variance, prior) => {
  if (!prior) return ''
  const p = Math.round((variance / Math.abs(prior)) * 1000) / 10
  return ` (${p > 0 ? '+' : ''}${String(p).replace('.', ',')}%)`
}

export function statementViews(s, { periodLabel, priorLabel = 'Previous period' }) {
  const hasPrior = s.priorPeriod !== null
  const asAt = longDate(s.period.to)
  const openingDate = longDate(shiftDays(s.period.from, -1))
  const change = (cents, prior) => `${money(cents - prior)}${cents - prior === 0 ? '' : pctText(cents - prior, prior)}`
  const incomeValues = (l) => (hasPrior ? [money(l.cents), money(l.priorCents), change(l.cents, l.priorCents)] : [money(l.cents)])
  const bsValues = (l) => [money(l.cents), money(l.priorCents)]

  // ── Income statement ──
  const i = s.income
  const incomeRows = [
    row('heading', 'Revenue'), ...i.revenue.map((l) => row('line', l.name, incomeValues(l))), row('total', 'Total revenue', incomeValues(i.totalRevenue)),
    ...(i.costOfSales.length ? [
      row('heading', 'Cost of sales'), ...i.costOfSales.map((l) => row('line', l.name, incomeValues(l))),
      row('total', 'Total cost of sales', incomeValues(i.totalCostOfSales)), row('total', 'Gross profit', incomeValues(i.grossProfit)),
    ] : []),
    ...(i.expenses.length ? [row('heading', 'Operating expenses'), ...i.expenses.map((l) => row('line', l.name, incomeValues(l))), row('total', 'Total operating expenses', incomeValues(i.totalExpenses))] : []),
    row('grand', 'Profit for the period (before income tax)', incomeValues(i.profit)),
    ...(i.tax ? [
      row('line', `Estimated income tax at ${String(i.tax.ratePercent).replace('.', ',')}% (estimate, not in your books)`, incomeValues({ cents: -i.tax.cents, priorCents: -(i.tax.priorCents ?? 0) })),
      row('total', 'Estimated profit after income tax', incomeValues({ cents: i.tax.afterCents, priorCents: i.tax.priorAfterCents })),
    ] : []),
  ]

  // ── Statement of financial position ──
  const b = s.balance
  const group = (label, list) => (list.length ? [row('subheading', label), ...list.map((l) => row('line', l.name, bsValues(l)))] : [])
  const balanceRows = [
    row('heading', 'Assets'), ...group('Non-current assets', b.nonCurrentAssets), ...group('Current assets', b.currentAssets), row('total', 'Total assets', bsValues(b.totalAssets)),
    row('heading', 'Equity and liabilities'), ...group('Equity', b.equity), row('total', 'Total equity', bsValues(b.totalEquity)),
    ...group('Non-current liabilities', b.nonCurrentLiabilities), ...group('Current liabilities', b.currentLiabilities), row('total', 'Total liabilities', bsValues(b.totalLiabilities)),
    row('grand', 'Total equity and liabilities', bsValues(b.totalLiabilitiesAndEquity)),
  ]

  // ── Statement of cash flows ──
  const c = s.cashFlow
  const one = (cents) => [money(cents)]
  const cashRows = [
    row('heading', 'Cash flows from operating activities'), row('line', 'Profit for the period (before income tax)', one(c.operating.profit)),
    ...c.operating.adjustments.map((a) => row('line', a.label, one(a.cents))), row('total', 'Cash generated from operations', one(c.operating.total)),
    row('heading', 'Cash flows from investing activities'), ...c.investing.lines.map((l) => row('line', l.label, one(l.cents))), row('total', 'Net cash from investing activities', one(c.investing.total)),
    row('heading', 'Cash flows from financing activities'), ...c.financing.lines.map((l) => row('line', l.label, one(l.cents))), row('total', 'Net cash from financing activities', one(c.financing.total)),
    row('grand', 'Net increase or (decrease) in cash', one(c.net)),
    row('line', 'Cash at the beginning of the period', one(c.opening)), row('grand', 'Cash at the end of the period', one(c.closing)),
  ]

  // ── Statement of changes in equity ──
  const equityRows = s.equityMovement.rows.map((r) => row(r.label === 'Opening balance' ? 'total' : r.label === 'Closing balance' ? 'grand' : 'line', r.label,
    [money(r.equityCents), money(r.retainedCents), money(r.totalCents)]))

  // ── Trial balance ──
  const t = s.trialBalance
  const trialRows = [
    ...t.rows.map((r) => row('line', `${r.code} ${r.name}`, [r.debitCents ? money(r.debitCents) : '', r.creditCents ? money(r.creditCents) : ''])),
    row('total', 'Totals', [money(t.totalDebit), money(t.totalCredit)]),
  ]

  return {
    income: { title: 'Income statement', subtitle: `For ${periodLabel}`, columns: hasPrior ? [periodLabel, priorLabel, 'Change'] : [periodLabel], rows: incomeRows, footnote: s.accountantNotes },
    balance: { title: 'Statement of financial position', subtitle: `As at ${asAt}`, columns: [asAt, openingDate], rows: balanceRows, footnote: s.accountantNotes },
    cashFlow: { title: 'Statement of cash flows', subtitle: `For ${periodLabel}`, columns: ['Amount'], rows: cashRows, footnote: s.accountantNotes },
    equity: { title: 'Statement of changes in equity', subtitle: `For ${periodLabel}`, columns: ['Owner equity', 'Retained earnings', 'Total'], rows: equityRows },
    trial: { title: 'Trial balance', subtitle: `As at ${asAt}`, columns: ['Debit', 'Credit'], rows: trialRows },
  }
}
