import { fmt } from './theme'

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const monthKey = (y, m) => `${y}-${m}`
export const monthSortValue = (mo) => mo.y * 12 + MONTH_ABBR.indexOf(mo.m)

// Turns a confirmed bank statement into a MONTHLY history entry for the
// period it covers — this is what lets Reports/CashFlow reflect real,
// reconciled data instead of only the static demo months.
export function buildMonthlyEntryFromBankData(bd) {
  const periodDate = new Date(bd.periodEnd || bd.periodStart)
  const valid = !isNaN(periodDate.getTime())
  const m = valid ? MONTH_ABBR[periodDate.getMonth()] : MONTH_ABBR[new Date().getMonth()]
  const y = valid ? periodDate.getFullYear() : new Date().getFullYear()

  const rev = bd.credits.reduce((s, t) => s + t.amount, 0)
  const exp = bd.debits.reduce((s, t) => s + t.amount, 0)
  const net = rev - exp

  return {
    m, y,
    fees: rev,
    subsidy: 0,
    rev,
    exp,
    net,
    cash: bd.closingBalance,
    take: `Reconciled from ${bd.bankName || 'bank'} statement (${bd.periodStart} to ${bd.periodEnd}). Revenue ${fmt(rev)}, expenses ${fmt(exp)}, ${net >= 0 ? 'profit' : 'loss'} of ${fmt(Math.abs(net))}.`,
    source: 'bank',
  }
}

// Merges reconciled (real) months over the tenant's base/demo MONTHLY array,
// keyed by year+month so a reconciled statement replaces any placeholder for
// the same period instead of duplicating it, then re-sorts chronologically.
export function mergeMonthly(baseMonthly, reconciledEntries) {
  const byKey = {}
  ;(baseMonthly || []).forEach(mo => { byKey[monthKey(mo.y, mo.m)] = mo })
  ;(reconciledEntries || []).forEach(mo => { byKey[monthKey(mo.y, mo.m)] = mo })
  return Object.values(byKey).sort((a, b) => monthSortValue(a) - monthSortValue(b))
}
