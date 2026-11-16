import { useState } from 'react'
import { C } from '../../lib/theme'
import { formatRand } from '../../lib/invoicing'
import { accountChoices } from '../../lib/bankPosting'
import { inputStyle } from '../invoices/fields'

const NO_VAT_CHOICES = new Set(['2000', '3000'])

/** One bank line waiting for the client: Zeeder's suggestion is filled in, the client confirms or changes it. */
export function BankLineRow({ line, suggestion, accounts, vatRegistered, busy, note, ruleName, onPost, onSkip }) {
  const [account, setAccount] = useState(suggestion.account)
  const [vat, setVat] = useState(suggestion.vat)
  const [remember, setRemember] = useState(!!ruleName && suggestion.confidence !== 'high')
  const choices = accountChoices(line.type, accounts)
  const showVat = vatRegistered && account && !NO_VAT_CHOICES.has(account)
  const money = line.type === 'credit' ? 'Money in' : 'Money out'

  return (
    <div className="glass" style={{ padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 14, color: C.text }}>
        <span><strong className="num">{formatRand(line.cents)}</strong> · {money} · {line.tx.date} · {line.tx.description}</span>
        <span style={{ color: C.label, fontSize: 12 }}>{suggestion.reason}</span>
      </div>
      {note && <div style={{ fontSize: 13, color: C.watch }}>{note}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ minWidth: 240, flex: '1 1 240px' }}>
          <span style={{ display: 'block', fontSize: 12, color: C.label, marginBottom: 4 }}>What was it for?</span>
          <select style={inputStyle} value={account} onChange={(e) => setAccount(e.target.value)} aria-label={`Category for ${line.tx.description}`}>
            <option value="">Choose…</option>
            {choices.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        {showVat && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: C.text, minHeight: 40 }}><input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} />Includes 15% VAT</label>}
        {ruleName && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: C.soft, minHeight: 40 }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember this for “{ruleName}”</label>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn-gold" disabled={!account || busy} onClick={() => onPost({ account, vat: !!showVat && vat, remember: !!ruleName && remember })}>{busy ? 'Posting…' : 'Post to my books'}</button>
        {onSkip && <button type="button" className="btn-ghost" disabled={busy} onClick={onSkip}>Not business / set aside</button>}
      </div>
    </div>
  )
}
