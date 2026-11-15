// A small worked example shared by the statements tests: two months of trading, checked by hand.
// A small chart (the same codes as the database seeds).
export const accounts = [
  ['1000', 'Bank', 'asset'], ['1100', 'Debtors (trade receivables)', 'asset'], ['1200', 'Stock', 'asset'], ['1500', 'Equipment', 'asset'],
  ['2000', 'Creditors (trade payables)', 'liability'], ['2200', 'VAT output', 'liability'], ['2210', 'VAT input', 'asset'], ['2300', 'Loans', 'liability'],
  ['3000', 'Owner equity', 'equity'], ['3100', 'Retained earnings', 'equity'],
  ['4000', 'Sales', 'income'], ['4100', 'Other income', 'income'], ['5000', 'Cost of sales', 'expense'],
  ['6200', 'Rent', 'expense'], ['6900', 'Other expenses', 'expense'],
].map(([code, name, type]) => ({ code, name, type }))

// Journal entries as [date, [[account, debit, credit], ...]]
export const entries = [
  ['2026-06-01', [['1000', 10000000, 0], ['3000', 0, 10000000]]],                          // opening bank R100 000
  ['2026-06-15', [['1100', 575000, 0], ['4000', 0, 500000], ['2200', 0, 75000]]],           // June invoice R5 750
  ['2026-06-20', [['6200', 100000, 0], ['2210', 15000, 0], ['1000', 0, 115000]]],           // June rent paid R1 150
  ['2026-07-01', [['1100', 1150000, 0], ['4000', 0, 1000000], ['2200', 0, 150000]]],        // July invoice R11 500
  ['2026-07-10', [['1000', 500000, 0], ['1100', 0, 500000]]],                               // payment R5 000
  ['2026-07-12', [['6200', 200000, 0], ['2210', 30000, 0], ['1000', 0, 230000]]],           // July rent paid R2 300
  ['2026-07-15', [['6900', 100000, 0], ['2210', 15000, 0], ['2000', 0, 115000]]],           // unpaid expense R1 150
  ['2026-07-20', [['3000', 100000, 0], ['1000', 0, 100000]]],                               // owner drawings R1 000
  ['2026-08-05', [['6900', 500, 0], ['1000', 0, 500]]],                                     // after the period: must not count
]
// What the database ledger_totals(from, to) returns.
export function totals(from, to, list = entries) {
  const by = {}
  for (const [date, lines] of list) {
    if (date > to) continue
    for (const [account, d, c] of lines) {
      const t = (by[account] ??= { account_code: account, opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 0 })
      const k = date < from ? 'opening' : 'period'
      t[`${k}_debit`] += d; t[`${k}_credit`] += c
    }
  }
  return Object.values(by)
}

