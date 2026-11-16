// Financial statements from the ledger, in the layout of IFRS for SMEs: income statement (Section 5),
// statement of financial position (4), statement of cash flows (7, indirect method), statement of changes
// in equity (6), plus a trial balance. Pure arithmetic on whole cents: no network, no dates beyond the
// ones the database already applied (see ledger_totals in 20261115c).
//
// Input rows are ledger_totals(from, to): per account, everything before `from` (opening_*) and everything
// from `from` to `to` (period_*). `prior` is the same call for the comparison period.

const BANK = '1000', DEBTORS = '1100', STOCK = '1200', EQUIPMENT = '1500', ACC_DEPRECIATION = '1510', CREDITORS = '2000', VAT_OUTPUT = '2200',
  VAT_INPUT = '2210', LOANS = '2300', OWNER = '3000', RETAINED = '3100', COST_OF_SALES = '5000'

const ZERO = { od: 0, oc: 0, pd: 0, pc: 0 }
const index = (rows) => Object.fromEntries((rows ?? []).map((r) => [r.account_code, {
  od: Number(r.opening_debit), oc: Number(r.opening_credit), pd: Number(r.period_debit), pc: Number(r.period_credit),
}]))
const openingDr = (t) => t.od - t.oc                 // net debit balance at the start of the period
const periodDr = (t) => t.pd - t.pc                  // net debit movement during the period
const closingDr = (t) => openingDr(t) + periodDr(t)  // net debit balance at the end
const pct1 = (n) => Math.round(n * 10) / 10
const nz = (n) => n || 0                          // turns -0 into 0 so nothing ever prints a stray minus
const sum = (list, key) => list.reduce((s, l) => s + (l[key] ?? 0), 0)

const FLAG_MIN_CENTS = 100000      // R1 000
const FLAG_MIN_PCT = 10

const BASIS_NOTES = [
  'Prepared on the accrual basis from the invoices, payments and transactions recorded in Zeeder, in South African rand.',
  'Presented in the format of IFRS for SMEs. These statements are management information: they are not audited or reviewed.',
]

/**
 * What a qualified accountant should look at before these are relied on. Each item is about a judgement or an
 * estimate Zeeder cannot make for the client, so the wording depends on what has actually been recorded.
 */
export function accountantNotes({ hasEquipment, hasStock, taxRatePercent, bankLinesPosted = 0 }) {
  return [
    hasEquipment
      ? 'Depreciation is straight-line over the useful life and value left at the end entered for each item. These are estimates. SARS wear-and-tear allowances follow different rules, so taxable income will differ.'
      : 'No equipment has been recorded, so no depreciation is charged. If the business owns equipment or vehicles, add them so depreciation is charged.',
    hasStock
      ? 'Stock is carried at the value entered at the last count. Zeeder does not check the count or the valuation, which should be the lower of cost and net realisable value.'
      : 'No stock count has been recorded. If the business holds stock, enter a count so cost of sales and stock are right.',
    taxRatePercent == null
      ? 'No income tax estimate is shown because no rate has been set, so profit is before income tax.'
      : `Income tax is an estimate: ${String(taxRatePercent).replace('.', ',')}% of profit before tax, floored at nil. It is not recorded in the books and is not a tax calculation. Taxable income differs from accounting profit (allowances, non-deductible items, assessed losses, provisional payments), and no deferred tax is recognised.`,
    ...(bankLinesPosted > 0 ? [`${bankLinesPosted} bank statement line${bankLinesPosted === 1 ? ' was' : 's were'} categorised by Zeeder's rules and the client's own corrections. A sample should be checked against the bank statements.`] : []),
    'These statements are not audited or reviewed. Have a qualified accountant review them before using them for tax, funding or statutory purposes.',
  ]
}

export function buildStatements({ accounts, current, prior = null, from, to, priorFrom = null, priorTo = null, taxRatePercent = null, bankLinesPosted = 0 }) {
  const chart = [...accounts].sort((a, b) => a.code.localeCompare(b.code))
  const cur = index(current)
  const pri = prior ? index(prior) : null
  const at = (m, code) => m[code] ?? ZERO
  const nameOf = (code) => chart.find((a) => a.code === code)?.name ?? code
  const ofType = (type) => chart.filter((a) => a.type === type)
  const pnl = chart.filter((a) => a.type === 'income' || a.type === 'expense')

  // ── Income statement ──
  const pLine = (a, sign) => {
    const cents = nz(sign * periodDr(at(cur, a.code)))
    const priorCents = pri ? nz(sign * periodDr(at(pri, a.code))) : null
    return { code: a.code, name: a.name, cents, priorCents }
  }
  const shown = (l) => l.cents !== 0 || (l.priorCents ?? 0) !== 0
  const total = (list) => ({ cents: sum(list, 'cents'), priorCents: pri ? sum(list, 'priorCents') : null })
  const revenue = ofType('income').map((a) => pLine(a, -1)).filter(shown)
  const costOfSales = ofType('expense').filter((a) => a.code === COST_OF_SALES).map((a) => pLine(a, 1)).filter(shown)
  const expenses = ofType('expense').filter((a) => a.code !== COST_OF_SALES).map((a) => pLine(a, 1)).filter(shown)
  const totalRevenue = total(revenue), totalCos = total(costOfSales), totalExpenses = total(expenses)
  const minus = (a, b) => ({ cents: a.cents - b.cents, priorCents: pri ? a.priorCents - b.priorCents : null })
  const grossProfit = minus(totalRevenue, totalCos)
  const profit = minus(grossProfit, totalExpenses)
  const margin = (n) => (totalRevenue.cents ? pct1((n / totalRevenue.cents) * 100) : null)

  const flags = []
  if (pri) {
    for (const [list, income] of [[revenue, true], [costOfSales, false], [expenses, false]]) {
      for (const l of list) {
        const varianceCents = l.cents - l.priorCents
        const pct = l.priorCents !== 0 ? pct1((varianceCents / Math.abs(l.priorCents)) * 100) : null
        if (Math.abs(varianceCents) >= FLAG_MIN_CENTS && (pct === null || Math.abs(pct) >= FLAG_MIN_PCT)) {
          flags.push({ label: l.name, varianceCents, pct, direction: (varianceCents > 0) === income ? 'favourable' : 'unfavourable' })
        }
      }
    }
  }
  // Income tax is only an estimate for the reader: it is never in the ledger, so the balance sheet is unaffected.
  const taxOn = (cents) => Math.max(0, Math.round((cents * taxRatePercent) / 100))
  const tax = taxRatePercent == null ? null : {
    ratePercent: taxRatePercent, cents: taxOn(profit.cents), priorCents: pri ? taxOn(profit.priorCents) : null,
    afterCents: profit.cents - taxOn(profit.cents), priorAfterCents: pri ? profit.priorCents - taxOn(profit.priorCents) : null,
  }
  const income = { revenue, totalRevenue, costOfSales, totalCostOfSales: totalCos, grossProfit, expenses, totalExpenses, profit, tax,
    margins: { gross: margin(grossProfit.cents), net: margin(profit.cents) }, flags }

  // ── Statement of financial position ──
  // The comparison is the position at the start of the period (everything dated before `from`).
  const bsLine = (a, sign) => ({ code: a.code, name: a.name, cents: nz(sign * closingDr(at(cur, a.code))), priorCents: nz(sign * openingDr(at(cur, a.code))) })
  const bsShown = (l) => l.cents !== 0 || l.priorCents !== 0
  const assets = ofType('asset').map((a) => bsLine(a, 1)).filter(bsShown)
  const liabilities = ofType('liability').map((a) => bsLine(a, -1)).filter(bsShown)
  const profitToDate = nz(-sum(pnl.map((a) => ({ v: closingDr(at(cur, a.code)) })), 'v'))
  const profitBefore = nz(-sum(pnl.map((a) => ({ v: openingDr(at(cur, a.code)) })), 'v'))
  const equityAccounts = ofType('equity').filter((a) => a.code !== RETAINED).map((a) => bsLine(a, -1)).filter(bsShown)
  const retained = {
    code: RETAINED, name: nameOf(RETAINED),
    cents: nz(-closingDr(at(cur, RETAINED)) + profitToDate), priorCents: nz(-openingDr(at(cur, RETAINED)) + profitBefore),
  }
  const equity = [...equityAccounts, ...(bsShown(retained) ? [retained] : [])]
  const t = (list) => ({ cents: sum(list, 'cents'), priorCents: sum(list, 'priorCents') })
  const nonCurrentAssets = assets.filter((l) => l.code === EQUIPMENT || l.code === ACC_DEPRECIATION)
  const currentAssets = assets.filter((l) => l.code !== EQUIPMENT && l.code !== ACC_DEPRECIATION)
  const nonCurrentLiabilities = liabilities.filter((l) => l.code === LOANS)
  const currentLiabilities = liabilities.filter((l) => l.code !== LOANS)
  const totalAssets = t(assets), totalLiabilities = t(liabilities), totalEquity = t(equity)
  const totalLiabilitiesAndEquity = { cents: totalLiabilities.cents + totalEquity.cents, priorCents: totalLiabilities.priorCents + totalEquity.priorCents }
  const balance = {
    currentAssets, nonCurrentAssets, totalAssets, currentLiabilities, nonCurrentLiabilities, totalLiabilities, equity, totalEquity, totalLiabilitiesAndEquity,
    balanced: totalAssets.cents === totalLiabilitiesAndEquity.cents && totalAssets.priorCents === totalLiabilitiesAndEquity.priorCents,
  }

  // ── Statement of cash flows (indirect): profit, then what each balance-sheet account did to cash ──
  const move = (code) => nz(-periodDr(at(cur, code)))     // cash effect of the net movement on a balance-sheet account
  const known = new Set([BANK, DEBTORS, STOCK, EQUIPMENT, ACC_DEPRECIATION, CREDITORS, VAT_OUTPUT, VAT_INPUT, LOANS, OWNER, RETAINED])
  const otherOperating = chart.filter((a) => (a.type === 'asset' || a.type === 'liability') && !known.has(a.code)).reduce((s, a) => s + move(a.code), 0)
  const adjustments = [
    ['Depreciation (not a cash cost)', move(ACC_DEPRECIATION)],
    ['Decrease or (increase) in debtors', move(DEBTORS)], ['Decrease or (increase) in stock', move(STOCK)],
    ['Decrease or (increase) in VAT receivable', move(VAT_INPUT)], ['Increase or (decrease) in creditors', move(CREDITORS)],
    ['Increase or (decrease) in VAT payable', move(VAT_OUTPUT)], ['Other working capital movements', otherOperating],
  ].filter(([, cents]) => cents !== 0).map(([label, cents]) => ({ label, cents }))
  const operating = { profit: profit.cents, adjustments, total: profit.cents + sum(adjustments, 'cents') }
  const investingLines = [{ label: 'Purchase of equipment', cents: move(EQUIPMENT) }].filter((l) => l.cents !== 0)
  const owner = at(cur, OWNER)
  const financingLines = [
    { label: 'Owner contributions', cents: owner.pc }, { label: 'Owner drawings', cents: nz(-owner.pd) },
    ...[{ label: 'Loans raised or (repaid)', cents: move(LOANS) }, { label: 'Other equity movements', cents: move(RETAINED) }].filter((l) => l.cents !== 0),
  ]
  const investing = { lines: investingLines, total: sum(investingLines, 'cents') }
  const financing = { lines: financingLines, total: sum(financingLines, 'cents') }
  const net = operating.total + investing.total + financing.total
  const opening = openingDr(at(cur, BANK)), closing = closingDr(at(cur, BANK))
  const cashFlow = { operating, investing, financing, net, opening, closing, reconciles: net === closing - opening }

  // ── Statement of changes in equity ──
  const capitalOpen = nz(-sum(ofType('equity').filter((a) => a.code !== RETAINED).map((a) => ({ v: openingDr(at(cur, a.code)) })), 'v'))
  const capitalClose = nz(-sum(ofType('equity').filter((a) => a.code !== RETAINED).map((a) => ({ v: closingDr(at(cur, a.code)) })), 'v'))
  const otherRetained = move(RETAINED)
  const row = (label, equityCents, retainedCents) => ({ label, equityCents, retainedCents, totalCents: equityCents + retainedCents })
  const equityMovement = {
    rows: [
      row('Opening balance', capitalOpen, retained.priorCents),
      row('Profit for the period', 0, profit.cents),
      row('Owner contributions', owner.pc, 0),
      row('Owner drawings', nz(-owner.pd), 0),
      ...(otherRetained !== 0 ? [row('Other movements', 0, otherRetained)] : []),
      row('Closing balance', capitalClose, retained.cents),
    ],
  }

  // ── Trial balance at the end of the period ──
  const tbRows = Object.keys(cur).sort().map((code) => ({ code, name: nameOf(code), dr: closingDr(cur[code]) })).filter((r) => r.dr !== 0)
    .map((r) => ({ code: r.code, name: r.name, debitCents: Math.max(r.dr, 0), creditCents: Math.max(-r.dr, 0) }))
  const trialBalance = { rows: tbRows, totalDebit: sum(tbRows, 'debitCents'), totalCredit: sum(tbRows, 'creditCents') }
  trialBalance.balanced = trialBalance.totalDebit === trialBalance.totalCredit

  return {
    period: { from, to }, priorPeriod: prior ? { from: priorFrom, to: priorTo } : null,
    income, balance, cashFlow, equityMovement, trialBalance, notes: BASIS_NOTES,
    accountantNotes: accountantNotes({ hasEquipment: closingDr(at(cur, EQUIPMENT)) !== 0 || closingDr(at(cur, ACC_DEPRECIATION)) !== 0, hasStock: closingDr(at(cur, STOCK)) !== 0 || periodDr(at(cur, STOCK)) !== 0, taxRatePercent, bankLinesPosted }),
  }
}
