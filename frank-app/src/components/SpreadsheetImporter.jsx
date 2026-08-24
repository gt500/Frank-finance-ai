import { useState, useRef } from 'react'
import { C, FONT_BODY, fmt } from '../lib/theme'

const DEBTOR_PATTERNS = {
  name:        ['name', 'client', 'customer', 'debtor', 'parent', 'learner', 'family', 'contact', 'child'],
  amount:      ['amount', 'balance', 'outstanding', 'owed', 'total', 'invoice amount', 'due amount'],
  ref:         ['ref', 'reference', 'invoice', 'inv no', 'inv#', 'inv ', 'number'],
  due:         ['due date', 'due', 'date', 'payment date'],
  daysOverdue: ['days overdue', 'days over', 'overdue days', 'aged', 'days late'],
  risk:        ['risk', 'status', 'priority', 'rating'],
}

const CREDITOR_PATTERNS = {
  name:     ['name', 'supplier', 'vendor', 'creditor', 'company', 'payee'],
  amount:   ['amount', 'balance', 'total', 'owed', 'invoice amount', 'outstanding'],
  ref:      ['ref', 'reference', 'invoice', 'inv no', 'po number', 'number'],
  due:      ['due date', 'due', 'payment date', 'date'],
  daysLeft: ['days left', 'days remaining', 'remaining', 'days to pay'],
  overdue:  ['overdue', 'status', 'past due'],
}

function detectColumn(header, patterns) {
  const h = (header || '').toLowerCase().trim()
  for (const [key, terms] of Object.entries(patterns)) {
    if (terms.some(t => h.includes(t))) return key
  }
  return '__ignore'
}

function buildDebtor(row, mapping, headers) {
  const get = key => {
    const col = Object.entries(mapping).find(([, v]) => v === key)?.[0]
    return col ? row[col] : undefined
  }
  const amount = parseFloat(String(get('amount') || '0').replace(/[^0-9.-]/g, '')) || 0
  const daysOverdue = parseInt(get('daysOverdue') || '0') || 0
  const risk = daysOverdue > 90 ? 'high' : daysOverdue > 30 ? 'med' : 'low'
  return {
    name:        String(get('name') || 'Unknown'),
    ref:         String(get('ref') || `IMP-${Math.floor(Math.random() * 999)}`),
    amount,
    due:         String(get('due') || ''),
    daysOverdue,
    risk:        String(get('risk') || risk),
    contact:     null,
  }
}

function buildCreditor(row, mapping) {
  const get = key => {
    const col = Object.entries(mapping).find(([, v]) => v === key)?.[0]
    return col ? row[col] : undefined
  }
  const amount = parseFloat(String(get('amount') || '0').replace(/[^0-9.-]/g, '')) || 0
  const daysLeft = parseInt(get('daysLeft') || '30') || 30
  const overdueRaw = String(get('overdue') || '').toLowerCase()
  const overdue = overdueRaw.includes('yes') || overdueRaw.includes('true') || overdueRaw.includes('overdue') || daysLeft < 0
  return {
    name:     String(get('name') || 'Unknown'),
    supplier: String(get('name') || 'Unknown'),
    ref:      String(get('ref') || `IMP-${Math.floor(Math.random() * 999)}`),
    amount,
    due:      String(get('due') || ''),
    daysLeft: Math.max(daysLeft, 0),
    overdue,
  }
}

const FIELD_LABELS = {
  name: 'Name', amount: 'Amount (R)', ref: 'Reference', due: 'Due Date',
  daysOverdue: 'Days Overdue', risk: 'Risk', daysLeft: 'Days Left', overdue: 'Overdue?',
  __ignore: '— Ignore —',
}

export function SpreadsheetImporter({ type, onImport, onClose }) {
  const fileRef = useRef(null)
  const [step, setStep]       = useState('upload') // upload | map | preview
  const [headers, setHeaders] = useState([])
  const [rows, setRows]       = useState([])
  const [mapping, setMapping] = useState({})
  const [parsed, setParsed]   = useState([])
  const [error, setError]     = useState('')

  const patterns = type === 'debtors' ? DEBTOR_PATTERNS : CREDITOR_PATTERNS
  const requiredFields = type === 'debtors'
    ? ['name', 'amount']
    : ['name', 'amount']

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!data.length) { setError('Spreadsheet is empty or could not be read.'); return }
      const hdrs = Object.keys(data[0])
      const autoMap = {}
      hdrs.forEach(h => { autoMap[h] = detectColumn(h, patterns) })
      setHeaders(hdrs)
      setRows(data)
      setMapping(autoMap)
      setStep('map')
    } catch {
      setError('Could not read file. Make sure it is a valid .xlsx, .xls, or .csv file.')
    }
  }

  function handleConfirmMapping() {
    const missing = requiredFields.filter(f => !Object.values(mapping).includes(f))
    if (missing.length) {
      setError(`Please map at least: ${missing.map(f => FIELD_LABELS[f]).join(', ')}`)
      return
    }
    const built = rows
      .map(row => type === 'debtors' ? buildDebtor(row, mapping, headers) : buildCreditor(row, mapping))
    if (!built.length) { setError('No rows found. Check your file has data rows below the header.'); return }
    setParsed(built)
    setError('')
    setStep('preview')
  }

  const fieldOptions = type === 'debtors'
    ? ['name','amount','ref','due','daysOverdue','risk','__ignore']
    : ['name','amount','ref','due','daysLeft','overdue','__ignore']

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT_BODY,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: step === 'preview' ? 720 : 540,
        maxHeight: '85vh', overflowY: 'auto',
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '32px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.frank, marginBottom: 4 }}>
              Import {type === 'debtors' ? 'Debtors' : 'Creditors'} from Spreadsheet
            </div>
            <div style={{ fontSize: 12, color: C.sub }}>
              Supports .xlsx, .xls, and .csv (Google Sheets → File → Download)
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <>
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${C.frank}40`, borderRadius: 10,
                padding: '48px 32px', textAlign: 'center', cursor: 'pointer',
                background: C.frankDim, marginBottom: 16,
              }}>
              <div style={{ fontSize: 32, color: C.frank, marginBottom: 12 }}>↑</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                Click to select your spreadsheet
              </div>
              <div style={{ fontSize: 12, color: C.sub }}>
                .xlsx · .xls · .csv — first sheet will be used
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
            {error && <div style={{ color: C.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
            <div style={{ marginTop: 16, padding: '12px 16px', background: `${C.frank}08`, border: `1px solid ${C.frank}20`, borderRadius: 8, fontSize: 12, color: C.sub }}>
              <strong style={{ color: C.gold }}>Google Sheets:</strong> File → Download → Microsoft Excel (.xlsx)
            </div>
          </>
        )}

        {/* Step: Map columns */}
        {step === 'map' && (
          <>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>
              {rows.length} rows found. Map each column to the right field — or ignore columns you don't need.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {headers.map(h => (
                <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 180, fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</div>
                  <div style={{ fontSize: 13, color: C.dim, marginRight: 4 }}>→</div>
                  <select
                    value={mapping[h] || '__ignore'}
                    onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 6,
                      border: `1px solid ${C.border}`, background: C.bg,
                      color: mapping[h] && mapping[h] !== '__ignore' ? C.frank : C.sub,
                      fontSize: 13, fontFamily: FONT_BODY, outline: 'none',
                    }}>
                    {fieldOptions.map(f => (
                      <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('upload')} style={{ padding: '10px 18px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontSize: 13, cursor: 'pointer', fontFamily: FONT_BODY }}>← Back</button>
              <button onClick={handleConfirmMapping} style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: C.frank, color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: FONT_BODY }}>
                Preview {rows.length} rows →
              </button>
            </div>
          </>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (() => {
          const validRows = parsed.filter(r => r.name && r.name !== 'Unknown' && r.amount > 0)
          const badRows   = parsed.filter(r => !r.name || r.name === 'Unknown' || r.amount === 0)
          return (
            <>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: badRows.length ? 8 : 16 }}>
                {validRows.length} rows ready to import.{parsed.length > validRows.length ? ` ${badRows.length} row${badRows.length !== 1 ? 's' : ''} skipped (missing name or zero amount).` : ''}
              </div>

              {badRows.length > 0 && (
                <div style={{ padding: '10px 14px', background: `${C.warn}10`, border: `1px solid ${C.warn}30`, borderRadius: 6, marginBottom: 16, fontSize: 12, color: C.warn }}>
                  <strong>Mapping issue detected:</strong> {badRows.length} row{badRows.length !== 1 ? 's' : ''} have no name or zero amount — likely the wrong columns were auto-detected. Go back and fix the column mapping, or proceed to import only the {validRows.length} valid rows.
                </div>
              )}

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: C.bg, padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                  {(type === 'debtors' ? ['Name', 'Amount', 'Due Date', 'Days Overdue'] : ['Supplier', 'Amount', 'Due Date', 'Status'])
                    .map(h => <div key={h} style={{ fontSize: 10, color: C.dim, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>{h}</div>)}
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {parsed.map((r, i) => {
                    const isValid = r.name && r.name !== 'Unknown' && r.amount > 0
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                        padding: '10px 16px',
                        borderBottom: i < parsed.length - 1 ? `1px solid ${C.border}` : 'none',
                        alignItems: 'center',
                        background: isValid ? 'transparent' : `${C.warn}08`,
                        opacity: isValid ? 1 : 0.6,
                      }}>
                        <div style={{ fontSize: 13, color: isValid ? C.text : C.warn, fontWeight: 600 }}>
                          {r.name || <em style={{ color: C.warn }}>No name</em>}
                          {!isValid && <span style={{ fontSize: 10, color: C.warn, marginLeft: 8 }}>⚠ SKIP</span>}
                        </div>
                        <div style={{ fontSize: 13, color: r.amount > 0 ? C.frank : C.warn, fontFamily: 'var(--mono)' }}>{fmt(r.amount)}</div>
                        <div style={{ fontSize: 12, color: C.sub }}>{r.due || '—'}</div>
                        <div style={{ fontSize: 12, color: type === 'debtors' ? (r.daysOverdue > 90 ? C.danger : r.daysOverdue > 30 ? C.warn : C.frank) : (r.overdue ? C.danger : C.frank) }}>
                          {type === 'debtors' ? (r.daysOverdue > 0 ? `${r.daysOverdue} days` : 'Current') : (r.overdue ? 'OVERDUE' : `${r.daysLeft}d left`)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('map')} style={{ padding: '10px 18px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontSize: 13, cursor: 'pointer', fontFamily: FONT_BODY }}>← Fix Mapping</button>
                <button
                  onClick={() => validRows.length ? onImport(validRows) : setError('No valid rows to import. Fix the column mapping first.')}
                  style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: validRows.length ? C.frank : C.dim, color: '#000', fontSize: 14, fontWeight: 800, cursor: validRows.length ? 'pointer' : 'not-allowed', fontFamily: FONT_BODY }}>
                  Import {validRows.length} {type === 'debtors' ? 'debtor' : 'creditor'}{validRows.length !== 1 ? 's' : ''} →
                </button>
              </div>
              {error && <div style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}
            </>
          )
        })()}
      </div>
    </div>
  )
}
