// Reporting periods and the comparison period beside each one. Dates are plain YYYY-MM-DD text; the
// arithmetic is done in UTC so a time zone can never move a date.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY = 86400000

export const PERIOD_KINDS = [
  { id: 'month', label: 'This month' }, { id: 'lastMonth', label: 'Last month' }, { id: 'quarter', label: 'This quarter' },
  { id: 'ytd', label: 'Year to date' }, { id: 'custom', label: 'Custom dates' },
]

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()                  // m is 1-12
const parts = (s) => s.split('-').map(Number)
const dayNo = (s) => Math.round(Date.parse(`${s}T00:00:00Z`) / DAY)
const fromDayNo = (n) => new Date(n * DAY).toISOString().slice(0, 10)
export const shiftDays = (s, n) => fromDayNo(dayNo(s) + n)
const valid = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && fromDayNo(dayNo(s)) === s
export const longDate = (s) => { const [y, m, d] = parts(s); return `${d} ${MONTHS[m - 1]} ${y}` }

/** The whole calendar months `count` long that end `back` months before the month of `today`. */
function months(today, count, back) {
  const [y, m] = parts(today)
  const endIndex = y * 12 + (m - 1) - back
  const startIndex = endIndex - (count - 1)
  const ey = Math.floor(endIndex / 12), em = (endIndex % 12) + 1
  const sy = Math.floor(startIndex / 12), sm = (startIndex % 12) + 1
  return { from: iso(sy, sm, 1), to: iso(ey, em, daysIn(ey, em)) }
}
const monthLabel = (from, to) => {
  const [fy, fm] = parts(from), [ty, tm] = parts(to)
  if (fy === ty && fm === tm) return `${MONTHS[fm - 1]} ${fy}`
  return fy === ty ? `${MONTHS[fm - 1]} to ${MONTHS[tm - 1]} ${ty}` : `${MONTHS[fm - 1]} ${fy} to ${MONTHS[tm - 1]} ${ty}`
}

/** { from, to, priorFrom, priorTo, label } for a period kind; `custom` is { from, to }. */
export function periodRange(kind, today, custom) {
  if (kind === 'month' || kind === 'lastMonth') {
    const back = kind === 'month' ? 0 : 1
    const cur = months(today, 1, back), pri = months(today, 1, back + 1)
    return { ...cur, priorFrom: pri.from, priorTo: pri.to, label: monthLabel(cur.from, cur.to), priorLabel: monthLabel(pri.from, pri.to) }
  }
  if (kind === 'quarter') {
    const [y, m] = parts(today)
    const startMonth = Math.floor((m - 1) / 3) * 3 + 1
    const cur = months(iso(y, startMonth + 2, 1), 3, 0)
    const pri = months(iso(y, startMonth + 2, 1), 3, 3)
    return { ...cur, priorFrom: pri.from, priorTo: pri.to, label: monthLabel(cur.from, cur.to), priorLabel: monthLabel(pri.from, pri.to) }
  }
  if (kind === 'ytd') {
    const [y, m, d] = parts(today)
    const priorDay = m === 2 && d === 29 ? 28 : d
    return { from: iso(y, 1, 1), to: today, priorFrom: iso(y - 1, 1, 1), priorTo: iso(y - 1, m, priorDay), label: `1 January to ${longDate(today)}`, priorLabel: `1 January to ${priorDay} ${MONTHS[m - 1]} ${y - 1}` }
  }
  if (kind === 'custom') {
    if (!valid(custom?.from) || !valid(custom?.to)) throw new Error('Enter a valid start and end date.')
    if (dayNo(custom.to) < dayNo(custom.from)) throw new Error('The end date cannot be before the start date.')
    const length = dayNo(custom.to) - dayNo(custom.from) + 1
    return { from: custom.from, to: custom.to, priorFrom: fromDayNo(dayNo(custom.from) - length), priorTo: fromDayNo(dayNo(custom.from) - 1), label: `${longDate(custom.from)} to ${longDate(custom.to)}`, priorLabel: `${longDate(fromDayNo(dayNo(custom.from) - length))} to ${longDate(fromDayNo(dayNo(custom.from) - 1))}` }
  }
  throw new Error(`Unknown period: ${kind}`)
}
