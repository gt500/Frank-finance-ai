// Turning bank statement lines into ledger entries. Zeeder only posts a line by itself when it is SURE:
// the client taught it that name before, or it is something with one obvious treatment (bank fees, salaries,
// interest). Everything else waits for the client, who can also reverse any posted line and post it again.
//
// Pure functions: no network, no dates other than the ones on the lines. The database checks every entry
// again (balanced, one bank line posted once) in post_bank_line.
import { toCents } from './invoicing'
import { expenseEntry, ownerEntry, supplierPaymentEntry, vatIncluded } from './ledgerEntries'
import { isoDate } from './invoiceApi'

const BANK = '1000', CREDITORS = '2000', VAT_OUTPUT = '2200', OWNER = '3000', SALES = '4000', OTHER_INCOME = '4100'
const MEMO_MAX = 200

/** Lower case, letters and digits only, single spaces: so "ENGEN  Bellville 0412" matches "engen bellville". */
export const normalise = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** The text of a line used to look up a learned rule: the name Zeeder shows, then the raw description. */
const names = (line) => [normalise(line.entityName), normalise(line.description)].filter(Boolean)

/**
 * Every line of a statement with a key that identifies it across statements. Two statements that overlap give the
 * same line the same key, so it is never posted twice; two genuinely identical lines on one day are told apart
 * by their position (#1, #2).
 */
export function keyedLines(bankData) {
  const seen = new Map()
  const out = []
  for (const [type, list] of [['credit', bankData.credits ?? []], ['debit', bankData.debits ?? []]]) {
    for (const tx of list) {
      const cents = toCents(tx.amount)
      const base = `${type}|${isoDate(tx.date, tx.date ?? '')}|${cents}|${normalise(tx.description).slice(0, 150)}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      out.push({ key: `${base}#${n}`, type, tx, cents })
    }
  }
  return out
}

// Treatments with one obvious answer. VAT is false because these carry none.
const SURE_DEBIT = [
  [/\b(service|monthly|account|admin|card|sms|notification|bank|cash handling|cash deposit|transaction|fixed monthly) fees?\b|\bbank charges?\b/, '6400', 'Bank fee'],
  [/\binterest (charged|debit)|\bdebit interest\b|\boverdraft interest\b/, '6400', 'Interest charged by the bank'],
  [/\b(salary|salaries|wages?|payroll)\b/, '6100', 'Salaries and wages'],
]
// Likely, but VAT or the exact account depends on the supplier, so these are only suggestions.
const GUESS_DEBIT = [
  [/\brent(al)?\b|\blease\b/, '6200'], [/\b(eskom|electricity|municipal|water|telkom|vodacom|mtn|cell c|rain|fibre|internet|airtime)\b/, '6300'],
  [/\b(insurance|santam|outsurance|discovery|old mutual|sanlam)\b/, '6700'], [/\b(fuel|engen|shell|sasol|bp|caltex|total energies|toll)\b/, '6800'],
  [/\b(google ads|facebook ads|meta ads|advert|marketing|printing|signage)\b/, '6500'], [/\b(accountant|attorney|legal|audit|consulting)\b/, '6600'],
  [/\b(repair|maintenance|service centre|plumber|electrician)\b/, '6850'],
]
const NO_VAT = new Set([OWNER, CREDITORS, '6100', '6400', '6700'])

/** What Zeeder thinks a line is. confidence: 'high' (post it), 'low' (suggestion), 'none' (client must choose). */
export function classifyLine(line, { rules = [], vatRegistered = false } = {}) {
  const hay = names(line)
  const learned = rules.find((r) => hay.some((h) => h.includes(r.match)))
  if (learned) return { account: learned.account, vat: vatRegistered && learned.vat && !NO_VAT.has(learned.account), confidence: 'high', reason: `You told Zeeder that "${learned.match}" goes here` }
  const text = hay.join(' ')
  if (line.type === 'debit') {
    for (const [re, account, reason] of SURE_DEBIT) if (re.test(text)) return { account, vat: false, confidence: 'high', reason }
    for (const [re, account] of GUESS_DEBIT) if (re.test(text)) return { account, vat: vatRegistered && !NO_VAT.has(account), confidence: 'low', reason: 'Looks like this from the description' }
    return { account: '', vat: false, confidence: 'none', reason: 'Zeeder could not tell what this was for' }
  }
  if (/\binterest (received|earned|credit)|\bcredit interest\b/.test(text)) return { account: OTHER_INCOME, vat: false, confidence: 'high', reason: 'Interest paid to you by the bank' }
  return { account: SALES, vat: vatRegistered, confidence: 'low', reason: 'Money in that is not matched to an invoice' }
}

/** The accounts a client may choose for a line, with plain labels. */
export function accountChoices(type, accounts) {
  const named = (code) => accounts.find((a) => a.code === code)?.name ?? code
  if (type === 'credit') {
    return [[SALES, `${named(SALES)} (money for goods or services)`], [OTHER_INCOME, named(OTHER_INCOME)], [OWNER, 'Owner put money in']]
  }
  const expenses = accounts.filter((a) => a.type === 'expense' && a.code !== '6950').map((a) => [a.code, a.name])
  return [...expenses, [CREDITORS, 'Paying a supplier I already recorded'], [OWNER, 'Owner took money out']]
}

const memoOf = (line) => {
  const who = String(line.tx.entityName ?? '').trim(), what = String(line.tx.description ?? '').trim()
  const text = who && what && !normalise(what).startsWith(normalise(who)) ? `${who} - ${what}` : (what || who || 'Bank transaction')
  return `Bank: ${text}`.slice(0, MEMO_MAX)
}

/** The balanced entry for one line and the account the client chose. Throws a plain message if it cannot be built. */
export function bankEntry(line, { account, vat }) {
  if (!account) throw new Error('Choose what this was for.')
  const date = isoDate(line.tx.date, '')
  if (!date) throw new Error('This line has no valid date.')
  const total = line.cents
  const memo = memoOf(line)
  if (line.type === 'debit') {
    if (account === CREDITORS) return { ...supplierPaymentEntry({ date, description: memo, amountCents: total }), memo }
    if (account === OWNER) return { ...ownerEntry({ date, kind: 'drawing', amountCents: total }), memo }
    return { ...expenseEntry({ date, description: memo, account, totalCents: total, vat: !!vat, paid: true }), memo }
  }
  if (account === OWNER) return { ...ownerEntry({ date, kind: 'contribution', amountCents: total }), memo }
  const tax = vat ? vatIncluded(total) : 0
  if (total <= 0) throw new Error('Enter an amount greater than zero.')
  return {
    date, memo,
    lines: [{ account: BANK, debit: total, credit: 0 }, { account, debit: 0, credit: total - tax },
      ...(tax > 0 ? [{ account: VAT_OUTPUT, debit: 0, credit: tax }] : [])].filter((l) => l.debit > 0 || l.credit > 0),
  }
}
