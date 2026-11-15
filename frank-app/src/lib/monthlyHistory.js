export function buildMonthlyEntry(bankData) {
  const end = bankData.periodEnd ? new Date(bankData.periodEnd) : new Date()
  const rev = bankData.credits.reduce((s, t) => s + t.amount, 0)
  const exp = bankData.debits.reduce((s, t) => s + t.amount, 0)
  const net = Math.round(rev - exp)
  return { m: end.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }), y: end.getFullYear(),
    fees: Math.round(rev), subsidy: 0, rev: Math.round(rev), exp: Math.round(exp), net, cash: Math.round(bankData.closingBalance || 0),
    take: `From ${bankData.bankName || 'bank'} statement ${bankData.periodStart}–${bankData.periodEnd}: ${net >= 0 ? `R ${net.toLocaleString('en-ZA')} left over` : `R ${Math.abs(net).toLocaleString('en-ZA')} short`}.` }
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const monthNum = m => MONTHS.indexOf(String(m).slice(0, 3))
const withoutMonth = (history, entry) => (history || []).filter(h => !(h.m === entry.m && (h.y ?? null) === (entry.y ?? null)))
export function mergeMonthly(history, entry) {
  return [...withoutMonth(history, entry), entry].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || monthNum(a.m) - monthNum(b.m))
}
/** Drop the month a (cleared) bank statement contributed. Returns null when no months remain. */
export function removeMonthly(history, bankData) {
  const rest = withoutMonth(history, buildMonthlyEntry(bankData))
  return rest.length ? rest : null
}

const WEEKS_PER_MONTH = 4.33
/** Cash safety buffer = one week of average spending, over months that have statement data. 0 = no data yet. */
export function safetyBuffer(history) {
  const months = (history || []).filter((m) => (m.rev || 0) > 0 || (m.exp || 0) > 0)
  if (!months.length) return 0
  const avgMonthlySpend = months.reduce((a, m) => a + (m.exp || 0), 0) / months.length
  return Math.round(avgMonthlySpend / WEEKS_PER_MONTH / 1000) * 1000
}
