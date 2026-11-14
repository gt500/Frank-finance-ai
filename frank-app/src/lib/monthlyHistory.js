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
export function mergeMonthly(history, entry) {
  const rest = (history || []).filter(h => !(h.m === entry.m && (h.y ?? null) === (entry.y ?? null)))
  return [...rest, entry].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || monthNum(a.m) - monthNum(b.m))
}