import { useCallback, useEffect, useState } from 'react'
import { C } from '../../lib/theme'
import { formatRand, toCents } from '../../lib/invoicing'
import { vatIncluded } from '../../lib/ledgerEntries'
import * as ledger from '../../lib/ledgerApi'
import { todaySA } from '../../lib/invoiceApi'
import { Card } from '../shared'
import { Field, Notice, inputStyle } from '../invoices/fields'

const COMPANY_RATE = 27
const FUNDING = [['bank', 'Paid from the bank'], ['creditors', 'Still owed to the supplier'], ['opening', 'Already owned before I started using Zeeder']]
const BLANK_ASSET = { name: '', price: '', vat: true, funding: 'bank', date: todaySA(), years: '5', residual: '0' }

/** The three things that move profit that no invoice or bank line tells Zeeder about. */
export function Adjustments({ onChanged }) {
  const [assets, setAssets] = useState([])
  const [rate, setRate] = useState('')
  const [asset, setAsset] = useState(BLANK_ASSET)
  const [stock, setStock] = useState({ date: todaySA(), value: '' })
  const [confirm, setConfirm] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([ledger.listFixedAssets(), ledger.getTaxRate()])
      setAssets(a); setRate(r === null ? '' : String(r))
    } catch (e) { setNotice({ kind: 'error', text: `Couldn't load this section: ${e.message}` }) }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (work, okText, changesBooks = true) => {
    setBusy(true); setNotice(null)
    try { const out = await work(); await load(); if (changesBooks) onChanged(); setNotice({ kind: 'ok', text: typeof okText === 'function' ? okText(out) : okText }) }
    catch (e) { setNotice({ kind: 'error', text: e.message }) } finally { setBusy(false) }
  }

  const addAsset = (e) => {
    e.preventDefault()
    const total = toCents(asset.price), residual = toCents(asset.residual), years = Number(asset.years)
    const vat = asset.vat && asset.funding !== 'opening' ? vatIncluded(total) : 0
    if (!asset.name.trim()) return setNotice({ kind: 'error', text: 'Give the equipment a short name.' })
    if (!(years >= 1 && years <= 50) || !Number.isInteger(years * 12)) return setNotice({ kind: 'error', text: 'Enter how many years it will last, from 1 to 50.' })
    return run(async () => {
      await ledger.addFixedAsset({ name: asset.name.trim(), totalCents: total, vatCents: vat, date: asset.date, residualCents: residual, lifeMonths: Math.round(years * 12), funding: asset.funding })
      await ledger.postDepreciation(todaySA())
      setAsset(BLANK_ASSET)
    }, 'Equipment recorded. Depreciation is charged for each whole month that has passed.')
  }
  const removeAsset = (id) => run(async () => { await ledger.voidFixedAsset(id); setConfirm(null) }, 'Removed. Its purchase and depreciation were reversed.')
  const countStock = (e) => {
    e.preventDefault()
    run(() => ledger.postStockCount(stock.date, toCents(stock.value)), (id) => (id ? 'Stock count recorded.' : 'No change: your books already show that value.'))
  }
  const saveRate = (e) => {
    e.preventDefault()
    const n = Number(String(rate).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 45) return setNotice({ kind: 'error', text: 'Enter a rate between 0 and 45.' })
    return run(() => ledger.saveTaxRate(n), 'Tax rate saved.')
  }
  const set = (k) => (e) => setAsset({ ...asset, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const monthly = (a) => Math.round((Number(a.cost_cents) - Number(a.residual_cents)) / a.life_months)

  return (
    <Card title="Equipment, stock and income tax" sub="Things that change your profit but do not come from an invoice or a bank line. Your accountant should check these.">
      <div style={{ display: 'grid', gap: 18 }}>
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: C.text }}>Equipment and depreciation ({assets.length})</summary>
          <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
            {assets.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 14, color: C.text }}>
                <span>{a.name} · cost <span className="num">{formatRand(Number(a.cost_cents))}</span> · bought {a.purchase_date} · lasts {a.life_months / 12} years · depreciation <span className="num">{formatRand(monthly(a))}</span> a month</span>
                {confirm === a.id
                  ? <span style={{ display: 'flex', gap: 8 }}><button type="button" className="btn-gold" disabled={busy} onClick={() => removeAsset(a.id)}>Yes, remove it</button><button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>Keep it</button></span>
                  : <button type="button" className="btn-ghost" onClick={() => setConfirm(a.id)}>Remove (entered by mistake)</button>}
              </div>
            ))}
            <form onSubmit={addAsset} style={{ display: 'grid', gap: 12 }} aria-label="Add equipment">
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
                <Field label="Equipment name"><input style={inputStyle} value={asset.name} onChange={set('name')} placeholder="Delivery van" /></Field>
                <Field label="Price (R)" hint="The full price paid."><input style={inputStyle} inputMode="decimal" value={asset.price} onChange={set('price')} placeholder="0.00" /></Field>
                <Field label="Date bought"><input style={inputStyle} type="date" value={asset.date} onChange={set('date')} /></Field>
                <Field label="How was it paid for?"><select style={inputStyle} value={asset.funding} onChange={set('funding')}>{FUNDING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="Lasts (years)"><input style={inputStyle} inputMode="decimal" value={asset.years} onChange={set('years')} /></Field>
                <Field label="Worth at the end (R)" hint="Usually 0."><input style={inputStyle} inputMode="decimal" value={asset.residual} onChange={set('residual')} /></Field>
              </div>
              {asset.funding !== 'opening' && <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: C.text }}><input type="checkbox" checked={asset.vat} onChange={set('vat')} />The price includes 15% VAT</label>}
              <div><button type="submit" className="btn-gold" disabled={busy}>Add equipment</button></div>
            </form>
          </div>
        </details>

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: C.text }}>Stock count</summary>
          <form onSubmit={countStock} style={{ marginTop: 10, display: 'grid', gap: 12 }} aria-label="Stock count">
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
              <Field label="Date counted"><input style={inputStyle} type="date" value={stock.date} max={todaySA()} onChange={(e) => setStock({ ...stock, date: e.target.value })} /></Field>
              <Field label="Value of stock on the shelves (R)" hint="What it cost you, not what you will sell it for."><input style={inputStyle} inputMode="decimal" value={stock.value} onChange={(e) => setStock({ ...stock, value: e.target.value })} placeholder="0.00" /></Field>
            </div>
            <div style={{ fontSize: 13, color: C.soft }}>Zeeder moves your stock to this value and puts the difference in cost of sales, so what you sold is not overstated.</div>
            <div><button type="submit" className="btn-gold" disabled={busy || stock.value === ''}>Record stock count</button></div>
          </form>
        </details>

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: C.text }}>Income tax estimate{rate !== '' ? ` (${rate}%)` : ''}</summary>
          <form onSubmit={saveRate} style={{ marginTop: 10, display: 'grid', gap: 12 }} aria-label="Income tax rate">
            <Field label="Income tax rate (%)" hint="A company pays 27%. A sole proprietor or partnership pays on a sliding scale, so enter the average rate you expect and ask your accountant to confirm it.">
              <input style={{ ...inputStyle, maxWidth: 200 }} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={String(COMPANY_RATE)} />
            </Field>
            <div style={{ fontSize: 13, color: C.soft }}>This is an estimate shown under your profit. It is not recorded in your books and is not a tax return.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-gold" disabled={busy || rate === ''}>Save rate</button>
              <button type="button" className="btn-ghost" onClick={() => setRate(String(COMPANY_RATE))}>Use company rate (27%)</button>
            </div>
          </form>
        </details>
      </div>
    </Card>
  )
}
