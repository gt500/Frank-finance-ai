import { useState, useRef } from 'react'
import { C, fmt } from '../../lib/theme'
import { Card, SLabel, StatBox, Badge, ConfBadge, Spinner, Empty } from '../shared'
import { extractFromDocument } from '../../hooks/useFrank'

const DOC_TYPES = [
  { id:'debtor_age',       label:'Debtor Age Analysis',  icon:'📊', category:'debtor',   color:C.warn,   desc:'Full outstanding customer balances with 30/60/90 day aging. Export from Sage, Xero, or QB.' },
  { id:'customer_invoice', label:'Customer Invoice(s)',   icon:'🧾', category:'debtor',   color:C.warn,   desc:'Individual invoices you issued. Upload multiple at once. Frank extracts client, amount, due date.' },
  { id:'customer_stmt',    label:'Customer Statement',   icon:'📋', category:'debtor',   color:C.warn,   desc:'Statement showing a customer\'s account history and outstanding balance.' },
  { id:'supplier_invoice', label:'Supplier Invoice',     icon:'📬', category:'creditor', color:C.danger, desc:'Invoice from a supplier — what you owe them. Frank extracts name, amount, due date, line items.' },
  { id:'supplier_stmt',    label:'Supplier Statement',   icon:'📑', category:'creditor', color:C.danger, desc:'Statement from your supplier showing all outstanding invoices on your account.' },
  { id:'creditor_age',     label:'Creditor Age Analysis',icon:'📉', category:'creditor', color:C.danger, desc:'Full list of what you owe all suppliers with aging. Export from accounting software or clerk\'s Excel.' },
  { id:'bank_statement',   label:'Bank Statement',       icon:'🏦', category:'bank',     color:C.frank,  desc:'Bank statement in any format — PDF, CSV. Frank reads every transaction and categorises it.' },
]

const ACCEPTED = '.pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.webp'

export function Documents({ onAsk }) {
  const [activeType, setActiveType] = useState(null)
  const [files, setFiles]           = useState([])
  const [extracting, setExtracting] = useState(false)
  const [results, setResults]       = useState([])
  const [tab, setTab]               = useState('upload')
  const fileRef = useRef(null)

  const selectedType = DOC_TYPES.find(d => d.id === activeType)

  const handleFiles = (newFiles) => {
    const arr = Array.from(newFiles).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/') ||
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    )
    setFiles(arr)
    setResults([])
  }

  const extract = async () => {
    if (!files.length || !activeType) return
    setExtracting(true)
    const out = []
    for (const file of files) {
      try {
        const data = await extractFromDocument(file, selectedType.category)
        out.push({ file: file.name, data, category: selectedType.category })
      } catch (e) {
        out.push({ file: file.name, error: e.message, category: selectedType.category })
      }
    }
    setResults(out)
    setExtracting(false)
    setTab('results')
  }

  const allRecords = results.flatMap(r =>
    r.data?.debtors || r.data?.creditors || r.data?.transactions || []
  )

  return (
    <div className="fade-up">
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['upload','Upload'], ['results',`Results ${results.length ? `(${results.length})` : ''}`], ['all',`All Records ${allRecords.length ? `(${allRecords.length})` : ''}`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '5px 12px', borderRadius: 4,
            border: `1px solid ${tab === id ? C.frank : C.border}`,
            background: tab === id ? C.frankDim : 'transparent',
            color: tab === id ? C.frank : C.sub,
            fontSize: 10, cursor: 'pointer', fontWeight: tab === id ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'upload' && (
        <div>
          <SLabel>Step 1 — What are you uploading?</SLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
            {DOC_TYPES.map(t => (
              <div key={t.id} onClick={() => setActiveType(t.id)}
                className="hover-card"
                style={{ background: C.card, borderRadius: 7, padding: '12px', border: `1px solid ${activeType === t.id ? t.color + '66' : C.border}`, borderLeft: `3px solid ${activeType === t.id ? t.color : C.border}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: activeType === t.id ? t.color : C.text }}>{t.label}</div>
                    <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{t.category}</div>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: C.sub, lineHeight: 1.5 }}>{t.desc}</div>
              </div>
            ))}
          </div>

          {activeType && (
            <>
              <SLabel>Step 2 — Upload your {selectedType?.label}</SLabel>
              <input ref={fileRef} type="file" multiple accept={ACCEPTED} style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

              <div
                className="drop-zone"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
                style={{ border: `2px dashed ${files.length ? selectedType?.color + '55' : C.border}`, borderRadius: 8, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: files.length ? `${selectedType?.color}06` : 'transparent' }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>{files.length ? '✅' : selectedType?.icon}</div>
                {files.length === 0 ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: selectedType?.color, marginBottom: 4 }}>Drop files here or click to browse</div>
                    <div style={{ fontSize: 10, color: C.sub }}>PDF · Image (JPG/PNG) · Excel · CSV</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: selectedType?.color, marginBottom: 6 }}>{files.length} file{files.length > 1 ? 's' : ''} ready</div>
                    {Array.from(files).map(f => <div key={f.name} style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>{f.name} · {(f.size / 1024).toFixed(0)}KB</div>)}
                  </>
                )}
              </div>

              <button onClick={extract} disabled={!files.length || extracting}
                style={{ width: '100%', padding: '12px', borderRadius: 7, background: files.length && !extracting ? selectedType?.color : C.muted, border: 'none', color: C.bg, fontWeight: 700, fontSize: 13, cursor: files.length && !extracting ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {extracting ? <><Spinner color={C.bg} size={16} /> Frank is reading your document...</> : `Extract ${selectedType?.label} data →`}
              </button>
            </>
          )}

          {!activeType && <Empty message="Select a document type above to get started" />}
        </div>
      )}

      {tab === 'results' && (
        <div>
          {results.length === 0 ? <Empty message="No results yet — upload and extract a document first" /> : (
            results.map((r, ri) => (
              <Card key={ri} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: r.error ? 8 : 12 }}>
                  <span style={{ fontSize: 16 }}>{r.category === 'bank' ? '🏦' : r.category === 'debtor' ? '📥' : '📤'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{r.file}</div>
                    {r.data?.document_type && <div style={{ fontSize: 9, color: C.sub, marginTop: 1 }}>{r.data.document_type}</div>}
                  </div>
                  <Badge label={r.error ? 'FAILED' : 'EXTRACTED ✓'} color={r.error ? C.danger : C.frank} />
                </div>
                {r.error && <div style={{ padding: '8px 12px', background: `${C.danger}10`, border: `1px solid ${C.danger}33`, borderRadius: 4, fontSize: 10, color: C.danger }}>{r.error}</div>}
                {!r.error && r.data?.notes && <div style={{ padding: '6px 10px', background: `${C.amber}10`, border: `1px solid ${C.amber}33`, borderRadius: 4, fontSize: 10, color: C.sub, marginBottom: 8 }}><strong style={{ color: C.amber }}>Note: </strong>{r.data.notes}</div>}
                {!r.error && <ResultTable data={r.data} category={r.category} onAsk={onAsk} />}
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'all' && (
        <div>
          {allRecords.length === 0 ? <Empty message="No records extracted yet. Upload documents first." /> : (
            <div>
              <SLabel>All extracted records — {allRecords.length} total</SLabel>
              <AllRecordsTable records={allRecords} results={results} onAsk={onAsk} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultTable({ data, category, onAsk }) {
  if (category === 'debtor' && data?.debtors) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
          <StatBox label="Records" value={data.debtors.length} color={C.warn} />
          <StatBox label="Total Outstanding" value={fmt(data.total_outstanding || 0)} color={C.danger} />
          <StatBox label="High Risk" value={data.debtors.filter(d => d.days_overdue >= 60).length} color={C.danger} sub="60+ days overdue" />
        </div>
        <TableGrid headers={['Client', 'Reference', 'Amount', 'Due Date', 'Days Overdue', 'Confidence']}>
          {data.debtors.map((d, i) => (
            <TableRow key={i} cells={[
              <span style={{ fontWeight: 600, color: C.warn }}>{d.name}</span>,
              <span style={{ fontSize: 9, color: C.muted, fontFamily: 'var(--mono)' }}>{d.reference || '—'}</span>,
              <span style={{ fontFamily: 'var(--mono)', color: d.amount > 5000 ? C.danger : C.text, fontWeight: 600 }}>{fmt(d.amount)}</span>,
              <span style={{ fontSize: 9, color: C.sub }}>{d.due_date || '—'}</span>,
              <span style={{ fontSize: 10, fontWeight: 700, color: d.days_overdue >= 60 ? C.danger : d.days_overdue >= 30 ? C.warn : C.frank }}>{d.days_overdue > 0 ? `${d.days_overdue}d` : 'Current'}</span>,
              <ConfBadge value={d.confidence} />,
            ]} />
          ))}
        </TableGrid>
      </div>
    )
  }

  if (category === 'creditor' && data?.creditors) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
          <StatBox label="Records" value={data.creditors.length} color={C.danger} />
          <StatBox label="Total Owed" value={fmt(data.total_owed || 0)} color={C.danger} />
          <StatBox label="Overdue" value={data.creditors.filter(c => c.overdue || c.days_until_due < 0).length} color={C.danger} sub="suppliers" />
        </div>
        <TableGrid headers={['Supplier', 'Reference', 'Amount', 'Due Date', 'Status', 'Confidence']}>
          {data.creditors.map((c, i) => (
            <TableRow key={i} cells={[
              <span style={{ fontWeight: 600, color: C.danger }}>{c.supplier}</span>,
              <span style={{ fontSize: 9, color: C.muted, fontFamily: 'var(--mono)' }}>{c.reference || '—'}</span>,
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: (c.overdue || c.days_until_due < 0) ? C.danger : C.text }}>{fmt(c.amount)}</span>,
              <span style={{ fontSize: 9, color: C.sub }}>{c.due_date || '—'}</span>,
              <Badge label={(c.overdue || c.days_until_due < 0) ? 'OVERDUE' : 'OK'} color={(c.overdue || c.days_until_due < 0) ? C.danger : C.frank} size="sm" />,
              <ConfBadge value={c.confidence} />,
            ]} />
          ))}
        </TableGrid>
      </div>
    )
  }

  if (category === 'bank' && data?.transactions) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
          <StatBox label="Transactions" value={data.transactions.length} color={C.frank} />
          <StatBox label="Total Credits" value={fmt(data.total_credits || 0)} color={C.frank} />
          <StatBox label="Total Debits" value={fmt(data.total_debits || 0)} color={C.danger} />
          <StatBox label="Closing Balance" value={fmt(data.closing_balance || 0)} color={C.blue} />
        </div>
        <TableGrid headers={['Date', 'Description', 'Debit', 'Credit', 'Category']}>
          {data.transactions.slice(0, 30).map((t, i) => (
            <TableRow key={i} cells={[
              <span style={{ fontSize: 9, color: C.sub, fontFamily: 'var(--mono)' }}>{t.date}</span>,
              <span style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{t.description}</span>,
              <span style={{ fontFamily: 'var(--mono)', color: t.debit ? C.danger : C.muted, fontSize: 10 }}>{t.debit ? fmt(t.debit) : '—'}</span>,
              <span style={{ fontFamily: 'var(--mono)', color: t.credit ? C.frank : C.muted, fontSize: 10 }}>{t.credit ? fmt(t.credit) : '—'}</span>,
              <Badge label={t.category || 'Unknown'} color={C.purple} size="sm" />,
            ]} />
          ))}
        </TableGrid>
        {data.transactions.length > 30 && <div style={{ marginTop: 6, fontSize: 9, color: C.muted, textAlign: 'center' }}>Showing 30 of {data.transactions.length}</div>}
      </div>
    )
  }

  return null
}

function AllRecordsTable({ records, results, onAsk }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
      {records.slice(0, 50).map((rec, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.muted}22` }}>
          <div style={{ flex: 1, fontSize: 10, color: C.text }}>{rec.name || rec.supplier || rec.description || '—'}</div>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: C.text }}>{fmt(rec.amount || rec.credit || rec.debit || 0)}</div>
          {rec.confidence && <ConfBadge value={rec.confidence} />}
        </div>
      ))}
    </div>
  )
}

function TableGrid({ headers, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${headers.length},1fr)`, borderBottom: `1px solid ${C.border}` }}>
        {headers.map(h => <div key={h} style={{ padding: '6px 10px', fontSize: 8, color: C.muted, letterSpacing: 2, textTransform: 'uppercase' }}>{h}</div>)}
      </div>
      {children}
    </div>
  )
}

function TableRow({ cells }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length},1fr)`, borderBottom: `1px solid ${C.muted}22` }}>
      {cells.map((cell, i) => <div key={i} style={{ padding: '7px 10px', overflow: 'hidden' }}>{cell}</div>)}
    </div>
  )
}
