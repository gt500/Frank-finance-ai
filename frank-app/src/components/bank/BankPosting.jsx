import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { C } from '../../lib/theme'
import { formatRand, proposePaymentMatches, toCents } from '../../lib/invoicing'
import * as api from '../../lib/invoiceApi'
import * as ledger from '../../lib/ledgerApi'
import { bankEntry, classifyLine, keyedLines, normalise } from '../../lib/bankPosting'
import { openingBalanceEntry } from '../../lib/ledgerEntries'
import { shiftDays } from '../../lib/periods'
import { Card } from '../shared'
import { Notice } from '../invoices/fields'
import { BankLineRow } from './BankLineRow'

const BANK = '1000'
const ruleNameOf = (line) => {
  const who = normalise(line.tx.entityName)
  return who.length >= 3 ? who : normalise(line.tx.description).split(' ').slice(0, 3).join(' ')
}

/**
 * Bank statement lines into the books. Lines Zeeder is sure about are posted automatically once the reconciliation
 * is confirmed; everything else waits here with a suggestion. Nothing is final: a posted line can be reversed and
 * posted again, and posting twice is impossible (the line's key is unique in the database).
 */
export function BankPosting({ bankData }) {
  const [state, setState] = useState({ ready: false, accounts: [], rules: [], postings: [], docs: [], payments: [], vatRegistered: false, check: null })
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState('')
  const autoTried = useRef(new Set())
  const { ready, accounts, rules, postings, docs, payments, vatRegistered, check } = state

  const load = useCallback(async () => {
    try {
      const start = api.isoDate(bankData.periodStart, ''), end = api.isoDate(bankData.periodEnd, '')
      const [accs, rls, posts, d, p, settings, totals] = await Promise.all([
        ledger.getChartAccounts(), ledger.listBankRules(), ledger.listBankPostings(), api.listDocuments(), api.listPayments(), api.getSettings(),
        start && end ? ledger.getLedgerTotals(start, end) : Promise.resolve([]),
      ])
      const bank = totals.find((t) => t.account_code === BANK) ?? { opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 0 }
      const hadActivity = Number(bank.opening_debit) + Number(bank.opening_credit) > 0
      const booksCents = Number(bank.opening_debit) - Number(bank.opening_credit) + Number(bank.period_debit) - Number(bank.period_credit)
      setState({
        ready: true, accounts: accs, rules: rls, postings: posts, docs: d, payments: p, vatRegistered: !!settings?.vat_number?.trim(),
        check: start && end ? { start, booksCents, statementCents: toCents(bankData.closingBalance), openingCents: toCents(bankData.openingBalance), hadActivity } : null,
      })
    } catch (e) { setNotice({ kind: 'error', text: `Couldn't load your books: ${e.message}` }); setState((s) => ({ ...s, ready: true })) }
  }, [bankData.periodStart, bankData.periodEnd, bankData.closingBalance, bankData.openingBalance])
  useEffect(() => { load() }, [load])

  const view = useMemo(() => {
    if (!ready) return null
    const byKey = new Map(postings.map((p) => [p.line_key, p]))
    const invoices = docs.filter((d) => api.outstandingCents(d) > 0)
      .map((d) => ({ id: d.id, number: api.docLabel(d), customerName: d.customer_name, outstandingCents: api.outstandingCents(d) }))
    const lines = keyedLines(bankData)
    const appliedToInvoice = (l) => l.type === 'credit' && payments.some((p) => (p.reference || '').includes(api.bankLineKey(l.tx)))
    const open = lines.filter((l) => l.type === 'credit' && !appliedToInvoice(l))
    const held = new Set(proposePaymentMatches(open.map((l) => ({ id: l.tx.id, date: l.tx.date, description: l.tx.description, amount: l.tx.amount })), invoices).map((p) => p.lineId))
    const out = { posted: [], aside: [], pending: [], invoicePaid: 0 }
    for (const l of lines) {
      const posting = byKey.get(l.key)
      if (appliedToInvoice(l)) { out.invoicePaid += 1; continue }
      if (posting?.entry_id && posting.live) { out.posted.push({ ...l, posting }); continue }
      if (posting && !posting.entry_id) { out.aside.push(l); continue }
      const cls = classifyLine({ ...l.tx, type: l.type }, { rules, vatRegistered })
      const reversed = !!posting
      const heldForInvoice = l.type === 'credit' && held.has(l.tx.id)
      out.pending.push({ ...l, cls, reversed, heldForInvoice, auto: !reversed && !heldForInvoice && cls.confidence === 'high' && !!cls.account })
    }
    return out
  }, [ready, postings, docs, payments, rules, vatRegistered, bankData])

  // Post what Zeeder is sure about, once, when the reconciliation has been confirmed.
  useEffect(() => {
    if (!view || !bankData.isConfirmed) return
    const todo = view.pending.filter((l) => l.auto && !autoTried.current.has(l.key))
    if (todo.length === 0) return
    todo.forEach((l) => autoTried.current.add(l.key))
    ;(async () => {
      let ok = 0; const failed = []
      for (const l of todo) {
        try { await ledger.postBankLine(l.key, bankEntry(l, l.cls)); ok += 1 } catch (e) { failed.push(e.message) }
      }
      await load()
      setNotice(failed.length
        ? { kind: 'error', text: `Posted ${ok} line${ok === 1 ? '' : 's'}. ${failed.length} could not be posted: ${failed[0]}` }
        : { kind: 'ok', text: `Zeeder posted ${ok} line${ok === 1 ? '' : 's'} it was sure about. Check them below; any can be reversed.` })
    })()
  }, [view, bankData.isConfirmed, load])

  const run = async (key, work, okText) => {
    setBusy(key); setNotice(null)
    try { await work(); await load(); if (okText) setNotice({ kind: 'ok', text: okText }) }
    catch (e) { setNotice({ kind: 'error', text: e.message }) } finally { setBusy('') }
  }
  const post = (l, choice) => run(l.key, async () => {
    await ledger.postBankLine(l.key, bankEntry(l, choice))
    if (choice.remember) await ledger.saveBankRule(ruleNameOf(l), choice.account, choice.vat)
  }, 'Posted to your books.')
  const skip = (l) => run(l.key, () => ledger.skipBankLine(l.key), 'Set aside. It will not be posted.')
  const fix = (l) => run(l.key, () => ledger.reverseEntry(l.posting.entry_id), 'Reversed. It is back in the list so you can choose the right category.')
  const recordOpening = () => run('opening', () => ledger.postEntry(openingBalanceEntry({ date: shiftDays(check.start, -1), bankCents: check.openingCents })), 'Opening balance recorded.')

  if (!ready) return null
  const { posted, aside, pending } = view
  const waiting = pending.length

  return (
    <Card title="Post to your books" sub="Zeeder posts the lines it is sure about and asks about the rest. You can reverse anything it posts.">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 14, color: C.soft }} aria-label="Bank lines summary">
          {posted.length} posted · {waiting} waiting for you · {aside.length} set aside{view.invoicePaid > 0 ? ` · ${view.invoicePaid} recorded as invoice payments` : ''}
          {!bankData.isConfirmed && pending.some((l) => l.auto) && ' · Zeeder will post the lines it is sure about when you confirm this reconciliation.'}
        </div>
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        {pending.map((l) => (
          <BankLineRow key={`${l.key}:${l.reversed}`} line={l} suggestion={l.cls} accounts={accounts} vatRegistered={vatRegistered} busy={busy === l.key}
            ruleName={ruleNameOf(l)}
            note={l.reversed ? 'You reversed this line. Choose the right category and post it again.'
              : l.heldForInvoice ? 'This may be a payment for an unpaid invoice. Confirm it under “Payments to match” above, or choose a category here if it is not.' : undefined}
            onPost={(choice) => post(l, choice)} onSkip={() => skip(l)} />
        ))}
        {waiting === 0 && posted.length + aside.length > 0 && <div style={{ fontSize: 14, color: C.frank }}>Every line is dealt with.</div>}

        {posted.length > 0 && (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 14, color: C.text }}>Posted lines ({posted.length})</summary>
            <div style={{ marginTop: 8 }}>
              {posted.map((l) => (
                <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 14, color: C.text }}>
                  <span>{l.tx.date} · {l.tx.description} · <span className="num">{formatRand(l.cents)}</span></span>
                  <button type="button" className="btn-ghost" disabled={busy === l.key} onClick={() => fix(l)}>Wrong? Reverse it</button>
                </div>
              ))}
            </div>
          </details>
        )}
        {aside.length > 0 && (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 14, color: C.text }}>Set aside ({aside.length})</summary>
            <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
              {aside.map((l) => {
                const cls = classifyLine({ ...l.tx, type: l.type }, { rules, vatRegistered })
                return <BankLineRow key={l.key} line={l} suggestion={cls} accounts={accounts} vatRegistered={vatRegistered} busy={busy === l.key} note="Set aside earlier." onPost={(c) => post(l, c)} />
              })}
            </div>
          </details>
        )}

        {check && <BankCheck check={check} busy={busy === 'opening'} onOpening={recordOpening} />}
      </div>
    </Card>
  )
}

function BankCheck({ check, busy, onOpening }) {
  const diff = check.booksCents - check.statementCents
  return (
    <div className="glass" style={{ padding: 14, display: 'grid', gap: 8, fontSize: 14, color: C.soft }}>
      <div className="ttl">Does your bank balance agree?</div>
      <div>Your books show <strong className="num" style={{ color: C.text }}>{formatRand(check.booksCents)}</strong> in the bank at the end of this statement. The statement says <strong className="num" style={{ color: C.text }}>{formatRand(check.statementCents)}</strong>.</div>
      {diff === 0 ? <div style={{ color: C.frank }}>They agree.</div> : (
        <div style={{ color: C.watch }}>Difference: <span className="num">{formatRand(Math.abs(diff))}</span> {diff > 0 ? 'more' : 'less'} in your books. {check.hadActivity ? 'Lines still waiting above, or entries recorded twice, are the usual cause.' : ''}</div>
      )}
      {!check.hadActivity && check.openingCents > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div>Your books have nothing in the bank before this statement. The statement opened with <span className="num">{formatRand(check.openingCents)}</span>.</div>
          <div><button type="button" className="btn-gold" disabled={busy} onClick={onOpening}>{busy ? 'Recording…' : `Record opening balance of ${formatRand(check.openingCents)}`}</button></div>
        </div>
      )}
    </div>
  )
}
