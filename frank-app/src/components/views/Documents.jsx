import { useState, useRef } from 'react'
import { C, fmt } from '../../lib/theme'
import { Card, SLabel, StatBox, Badge, ConfBadge, Spinner, Empty } from '../shared'
import { extractFromDocument } from '../../hooks/useFrank'
import { useTenant } from '../../context/TenantContext'

const DOC_TYPES = [
  { id:'debtor_age',       label:'Debtor Age Analysis',  icon:'📊', category:'debtor',   color:C.warn,   desc:'Click to upload your debtor age analysis. PDF or CSV from any accounting system.' },
  { id:'customer_invoice', label:'Customer Invoice(s)',  icon:'🧾', category:'debtor',   color:C.warn,   desc:'Click to upload customer invoices. Zeeder extracts who owes what and when it\'s due.' },
  { id:'customer_stmt',    label:'Customer Statement',  icon:'📋', category:'debtor',   color:C.warn,   desc:'Click to upload a customer statement showing their outstanding balance.' },
  { id:'supplier_invoice', label:'Supplier Invoice',    icon:'📬', category:'creditor', color:C.danger, desc:'Click to upload a supplier invoice. Zeeder extracts what you owe and when.' },
  { id:'supplier_stmt',    label:'Supplier Statement',  icon:'📑', category:'creditor', color:C.danger, desc:'Click to upload a supplier statement showing all outstanding invoices.' },
  { id:'creditor_age',     label:'Creditor Age Analysis',icon:'📉', category:'creditor', color:C.danger, desc:'Click to upload your creditor age analysis — what you owe all suppliers.' },
  { id:'bank_statement',   label:'Bank Statement',      icon:'🏦', category:'bank',     color:C.frank,  desc:'Use CSV export from your bank\'s online portal — faster and more reliable than PDF.' },
  { id:'payroll_report',   label:'Payroll Report',      icon:'👥', category:'payroll',  color:C.frank,  desc:'Click to upload your SimplePay or payroll export. Zeeder extracts salary totals and PAYE.' },
]

const BANK_CSV_TIPS = [
  { bank: 'Absa',          steps: 'Accounts → My Statements → select date range → Download → CSV' },
  { bank: 'Nedbank',       steps: 'Online Banking → Statements → Export → CSV/Excel' },
  { bank: 'Standard Bank', steps: 'My accounts → Statements → Download statement → CSV' },
  { bank: 'FNB',           steps: 'Online Banking → Accounts → Statement → Export → CSV' },
  { bank: 'Capitec',       steps: 'Capitec Remote → Statements → Download → CSV' },
]

export function Documents({ onAsk, onNav }) {
  const { loadBankStatement, bankData, importedData, activeTenantId, clearBankData, clearImportedDebtors, clearImportedCreditors } = useTenant()
  const [activeType, setActiveType] = useState(null)
  const [files, setFiles]           = useState([])
  const [extracting, setExtracting] = useState(false)
  const [results, setResults]       = useState([])
  const [tab, setTab]               = useState('upload')
  const fileRef = useRef(null)

  const selectedType = DOC_TYPES.find(d => d.id === activeType)

  const handleFiles = (newFiles) => {
    setFiles(Array.from(newFiles))
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
    r.data?.debtors || r.data?.creditors || r.data?.transactions || r.data?.employees || []
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
            fontSize: 12, cursor: 'pointer', fontWeight: tab === id ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'upload' && (
        <div>

          {/* Active Uploads panel */}
          {(() => {
            const tenantImport = importedData?.[activeTenantId] || {}
            const hasBankData  = bankData?.isConfirmed
            const hasDebtors   = Array.isArray(tenantImport.DEBTORS)
            const hasCreditors = Array.isArray(tenantImport.CREDITORS)
            if (!hasBankData && !hasDebtors && !hasCreditors) return null
            return (
              <div style={{ marginBottom: 18, padding: '14px 18px', background: `${C.frank}06`, border: `1px solid ${C.frank}30`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: C.frank, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Active Uploads</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {hasBankData && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>🏦</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{bankData.bankName || 'Bank Statement'}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{bankData.periodStart} to {bankData.periodEnd} · {(bankData.credits?.length || 0) + (bankData.debits?.length || 0)} transactions</div>
                        </div>
                      </div>
                      <button onClick={clearBankData} style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${C.danger}30`, background: `${C.danger}08`, color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        ✕ Clear
                      </button>
                    </div>
                  )}
                  {hasDebtors && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>📊</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Imported Debtors</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{tenantImport.DEBTORS.length} row{tenantImport.DEBTORS.length !== 1 ? 's' : ''} from spreadsheet</div>
                        </div>
                      </div>
                      <button onClick={clearImportedDebtors} style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${C.danger}30`, background: `${C.danger}08`, color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        ✕ Clear
                      </button>
                    </div>
                  )}
                  {hasCreditors && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>📉</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Imported Creditors</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{tenantImport.CREDITORS.length} row{tenantImport.CREDITORS.length !== 1 ? 's' : ''} from spreadsheet</div>
                        </div>
                      </div>
                      <button onClick={clearImportedCreditors} style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${C.danger}30`, background: `${C.danger}08`, color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        ✕ Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          <SLabel>Click the document type you want to upload — Zeeder does the rest</SLabel>

          {/* Hidden input lives here — sibling to cards, ref always set on mount */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.csv,.jpg,.jpeg,.png,.webp,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
            {DOC_TYPES.map(t => (
              <div
                key={t.id}
                onClick={() => { fileRef.current.click(); setActiveType(t.id); setFiles([]) }}
                style={{
                  background: C.card, borderRadius: 7, padding: '12px',
                  border: `1px solid ${activeType === t.id ? t.color + '66' : C.border}`,
                  borderLeft: `3px solid ${activeType === t.id ? t.color : C.border}`,
                  cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 19 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: activeType === t.id ? t.color : C.text }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{t.category}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{t.desc}</div>
              </div>
            ))}
          </div>

          {activeType === 'bank_statement' && files.length === 0 && (
            <div style={{ marginBottom: 14, padding: '14px 18px', background: `${C.frank}08`, border: `1px solid ${C.frank}25`, borderLeft: `4px solid ${C.frank}`, borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.frank, marginBottom: 8 }}>How to export a CSV from your bank</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {BANK_CSV_TIPS.map(tip => (
                  <div key={tip.bank} style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                    <span style={{ color: C.text, fontWeight: 700, minWidth: 100 }}>{tip.bank}</span>
                    <span style={{ color: C.sub }}>{tip.steps}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: C.dim }}>CSV uploads are ~99% accurate. PDFs work too but may need a smaller date range if they fail.</div>
            </div>
          )}

          {!activeType && <Empty message="Click any document type above to choose your file" />}

          {activeType && files.length === 0 && activeType !== 'bank_statement' && (
            <div style={{ textAlign: 'center', padding: '20px', color: C.sub, fontSize: 13 }}>
              File picker opened for <strong style={{ color: selectedType?.color }}>{selectedType?.label}</strong> — select your file
            </div>
          )}

          {activeType === 'bank_statement' && files.length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px', color: C.sub, fontSize: 13 }}>
              File picker opened — select your CSV or PDF bank statement
            </div>
          )}

          {files.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${selectedType?.color}55`, borderRadius: 8,
                  padding: '20px', textAlign: 'center', cursor: 'pointer',
                  marginBottom: 14, background: `${selectedType?.color}06`,
                }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: selectedType?.color, marginBottom: 6 }}>
                  {files.length} file{files.length > 1 ? 's' : ''} ready for {selectedType?.label}
                </div>
                {files.map(f => (
                  <div key={f.name} style={{ fontSize: 12, color: C.sub, marginBottom: 2 }}>
                    {f.name} · {(f.size / 1024).toFixed(0)} KB
                  </div>
                ))}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Click to change files</div>
              </div>

              <button
                type="button"
                onClick={extract}
                disabled={extracting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 7,
                  background: extracting ? C.muted : selectedType?.color,
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: 16,
                  cursor: extracting ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                {extracting
                  ? <><Spinner color="#fff" size={16} /> Zeeder is reading your document — this may take up to 90 seconds...</>
                  : `Let Zeeder read this →`}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div>
          {results.length === 0 ? <Empty message="No results yet — upload and extract a document first" /> : (
            results.map((r, ri) => (
              <Card key={ri} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: r.error ? 8 : 12 }}>
                  <span style={{ fontSize: 16 }}>{r.category === 'bank' ? '🏦' : r.category === 'debtor' ? '📥' : r.category === 'payroll' ? '👥' : '📤'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{r.file}</div>
                    {r.data?.document_type && <div style={{ fontSize: 9, color: C.sub, marginTop: 1 }}>{r.data.document_type}</div>}
                  </div>
                  <Badge label={r.error ? 'FAILED' : 'EXTRACTED ✓'} color={r.error ? C.danger : C.frank} />
                  <button
                    onClick={() => setResults(prev => prev.filter((_, i) => i !== ri))}
                    title="Remove this result"
                    style={{ padding: '2px 7px', borderRadius: 3, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, fontSize: 13, cursor: 'pointer', lineHeight: 1, marginLeft: 4 }}>
                    ✕
                  </button>
                </div>
                {r.error && <div style={{ padding: '8px 12px', background: `${C.danger}10`, border: `1px solid ${C.danger}33`, borderRadius: 4, fontSize: 10, color: C.danger }}>{r.error}</div>}
                {!r.error && r.data?.notes && <div style={{ padding: '6px 10px', background: `${C.amber}10`, border: `1px solid ${C.amber}33`, borderRadius: 4, fontSize: 10, color: C.sub, marginBottom: 8 }}><strong style={{ color: C.amber }}>Note: </strong>{r.data.notes}</div>}
                {!r.error && <ResultTable data={r.data} category={r.category} onAsk={onAsk} />}
                {!r.error && r.category === 'bank' && r.data?.transactions?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: C.sub }}>
                      {r.data.transactions.length} transactions extracted · Send to Reconciliation to match customers and suppliers
                    </div>
                    <button
                      onClick={() => { loadBankStatement(r.data); onNav('reconcile') }}
                      style={{ padding: '9px 18px', borderRadius: 5, border: `1px solid ${C.frank}40`, background: C.frankMid, color: C.frank, fontSize: 12, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Load into Reconciliation →
                    </button>
                  </div>
                )}
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

  if (category === 'payroll' && data?.totals) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 10 }}>
          <StatBox label="Headcount" value={data.headcount || data.employees?.length || 0} color={C.frank} />
          <StatBox label="Gross Pay" value={fmt(data.totals.gross || 0)} color={C.text} />
          <StatBox label="PAYE" value={fmt(data.totals.paye || 0)} color={C.warn} sub="tax" />
          <StatBox label="UIF" value={fmt(data.totals.uif || 0)} color={C.sub} sub="insurance" />
          <StatBox label="Net Pay" value={fmt(data.totals.net || 0)} color={C.frank} />
        </div>
        {data.period && <div style={{ fontSize: 10, color: C.sub, marginBottom: 8 }}>Period: {data.period}{data.pay_date ? ` · Pay date: ${data.pay_date}` : ''}{data.payroll_system ? ` · ${data.payroll_system}` : ''}</div>}
        {data.employees?.length > 0 && (
          <TableGrid headers={['Employee', 'Gross', 'PAYE', 'UIF', 'Net Pay', 'Confidence']}>
            {data.employees.map((e, i) => (
              <TableRow key={e.name || i} cells={[
                <span style={{ fontWeight: 600 }}>{e.name}</span>,
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{fmt(e.gross_salary || 0)}</span>,
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: C.warn }}>{fmt(e.paye || 0)}</span>,
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: C.sub }}>{fmt(e.uif || 0)}</span>,
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: C.frank }}>{fmt(e.net_pay || 0)}</span>,
                <ConfBadge value={e.confidence} />,
              ]} />
            ))}
          </TableGrid>
        )}
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
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: C.text }}>{fmt(rec.amount || rec.net_pay || rec.gross_salary || rec.credit || rec.debit || 0)}</div>
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
