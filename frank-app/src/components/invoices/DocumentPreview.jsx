import { PAPER } from '../../lib/theme'

const lines = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean)

/** What the emailed PDF will say, drawn on a sheet of "paper". Takes the model from documentModel / statementModel. */
export function DocumentPreview({ model }) {
  const five = model.columns.length === 5
  const grid = five ? '1.2fr 1.9fr .9fr .9fr 1fr' : '3fr .6fr 1.2fr 1.3fr'
  const leftCols = five ? 2 : 1
  const cell = (i) => ({ textAlign: i < leftCols ? 'left' : 'right' })
  const party = (label, p) => (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 1.4, color: PAPER.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{p.name}</div>
      {lines(p.address).map((l) => <div key={l} style={{ color: PAPER.muted }}>{l}</div>)}
      {p.vat && <div style={{ color: PAPER.muted }}>VAT No: {p.vat}</div>}
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <article aria-label={`${model.title} ${model.number}`} style={{ background: PAPER.bg, color: PAPER.ink, borderRadius: 10, padding: 28, minWidth: 560, maxWidth: 780, fontSize: 13, lineHeight: 1.5 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{model.supplier.name || 'Your business name'}</div>
            {lines(model.supplier.address).map((l) => <div key={l} style={{ color: PAPER.muted }}>{l}</div>)}
            {model.supplier.vat && <div style={{ color: PAPER.muted }}>VAT No: {model.supplier.vat}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: PAPER.accent, letterSpacing: 0.5 }}>{model.title}</div>
            {model.number && <div style={{ fontWeight: 700 }}>{model.number}</div>}
            {model.meta.map(([k, v]) => <div key={k} style={{ color: PAPER.muted }}>{k}: {v}</div>)}
          </div>
        </header>

        {party(model.number ? 'BILL TO' : 'STATEMENT FOR', model.billTo)}

        <div role="table" style={{ marginTop: 22 }}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, fontSize: 10, letterSpacing: 1, color: PAPER.muted, paddingBottom: 6, borderBottom: `1px solid ${PAPER.rule}` }}>
            {model.columns.map((c, i) => <div role="columnheader" key={c} style={cell(i)}>{c}</div>)}
          </div>
          {model.rows.map((r, ri) => (
            <div role="row" key={ri} style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '8px 0', borderBottom: `1px solid ${PAPER.rule}` }}>
              {r.map((c, i) => <div role="cell" key={i} style={cell(i)}>{c}</div>)}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, marginLeft: 'auto', maxWidth: 300 }}>
          {model.totals.map(([k, v], i) => {
            const strong = i === model.totals.length - 1 || k === 'Balance due'
            return (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '3px 0', fontWeight: strong ? 700 : 400, color: strong ? PAPER.ink : PAPER.muted, fontSize: strong ? 15 : 13 }}>
                <span>{k}</span><span>{v}</span>
              </div>
            )
          })}
        </div>

        {model.aging.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.4, color: PAPER.muted, marginBottom: 6 }}>AGEING OF THE AMOUNT DUE</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${model.aging.length}, 1fr)`, gap: 8, textAlign: 'right' }}>
              {model.aging.map(([k]) => <div key={k} style={{ fontSize: 11, color: PAPER.muted }}>{k}</div>)}
              {model.aging.map(([k, v]) => <div key={`${k}v`} style={{ fontWeight: 700 }}>{v}</div>)}
            </div>
          </div>
        )}

        {model.notes.map((n, i) => <p key={i} style={{ margin: '14px 0 0' }}>{n}</p>)}
        {model.footer.map((n, i) => <p key={i} style={{ margin: '10px 0 0', fontSize: 12, color: PAPER.muted }}>{n}</p>)}
      </article>
    </div>
  )
}
