import { PAPER } from '../../lib/theme'

const WEIGHT = { heading: 700, subheading: 600, line: 400, total: 700, grand: 700 }

/** One statement on a sheet of "paper": business name, title, period, then the rows. */
export function StatementSheet({ business, view }) {
  const cols = view.columns.length
  const grid = `minmax(220px, 3fr) repeat(${cols}, minmax(110px, 1.2fr))`
  return (
    <div style={{ overflowX: 'auto' }}>
      <article className="print-area" aria-label={view.title} style={{ background: PAPER.bg, color: PAPER.ink, borderRadius: 10, padding: 28, minWidth: 560, maxWidth: 860, fontSize: 13, lineHeight: 1.5 }}>
        <header style={{ marginBottom: 18 }}>
          {business && <div style={{ fontSize: 15, fontWeight: 700 }}>{business}</div>}
          <h2 style={{ margin: '2px 0 0', fontSize: 20, color: PAPER.accent, letterSpacing: 0.3 }}>{view.title}</h2>
          <div style={{ color: PAPER.muted }}>{view.subtitle}</div>
        </header>
        <div role="table" aria-label={view.title}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, paddingBottom: 6, borderBottom: `1px solid ${PAPER.rule}`, fontSize: 11, color: PAPER.muted }}>
            <div role="columnheader" />
            {view.columns.map((c) => <div role="columnheader" key={c} style={{ textAlign: 'right' }}>{c}</div>)}
          </div>
          {view.rows.map((r, i) => (
            <div role="row" key={i} style={{
              display: 'grid', gridTemplateColumns: grid, gap: 8, padding: r.type === 'heading' ? '14px 0 4px' : '5px 0',
              fontWeight: WEIGHT[r.type], textTransform: r.type === 'heading' ? 'uppercase' : 'none', letterSpacing: r.type === 'heading' ? 0.8 : 0,
              fontSize: r.type === 'heading' ? 11 : r.type === 'grand' ? 14 : 13, color: r.type === 'heading' ? PAPER.muted : PAPER.ink,
              borderTop: r.type === 'total' || r.type === 'grand' ? `1px solid ${PAPER.rule}` : 'none',
              borderBottom: r.type === 'grand' ? `3px double ${PAPER.rule}` : 'none',
            }}>
              <div role="cell" style={{ paddingLeft: r.type === 'line' ? 14 : 0 }}>{r.label}</div>
              {view.columns.map((_, j) => <div role="cell" key={j} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.values[j] ?? ''}</div>)}
            </div>
          ))}
        </div>
        {view.footnote?.length > 0 && (
          <aside aria-label="Note for your accountant" style={{ marginTop: 22, paddingTop: 12, borderTop: `1px solid ${PAPER.rule}`, fontSize: 11, color: PAPER.muted, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>Note for your accountant</div>
            <ol style={{ margin: 0, paddingLeft: 16 }}>{view.footnote.map((n) => <li key={n}>{n}</li>)}</ol>
          </aside>
        )}
      </article>
    </div>
  )
}
