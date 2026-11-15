import { C } from '../../lib/theme'
import { niceTicks, randTick } from './scale'

// Horizontal bar chart: time runs DOWN the Y axis (one row per month or week), rand runs ACROSS.
// Every bar carries its figure; a row can be clicked to select it; a row with no data says so.
//
// rows: [{ key, label, sub, bars: [{ value, color, text, tip }], side?: { value, text, tip }, none?: string }]
// side:      optional own column (e.g. net profit) — its own scale, never a second axis on the same bars
// threshold: optional { value, label, color } vertical reference line (e.g. a cash safety buffer)

const W = 840, LABEL_X = 88, X0 = 100, TOP = 30

export function HBarChart({ rows, yTitle, xTitle, side, threshold, selectedKey, onSelect, ariaLabel, formatValue = randTick }) {
  const x1 = side ? 480 : 700
  const sideX0 = 570, sideW = 60
  const maxBars = Math.max(1, ...rows.map((r) => r.bars.length))
  const ROW = 34
  const bh = maxBars > 1 ? 11 : 16
  const ticks = niceTicks(Math.max(threshold?.value ?? 0, ...rows.flatMap((r) => r.bars.map((b) => b.value || 0))))
  const top = ticks[ticks.length - 1]
  const sx = (v) => (Math.max(0, v) / top) * (x1 - X0)
  const sideMax = side ? Math.max(1, ...rows.map((r) => Math.abs(r.side?.value || 0))) : 1
  const axisY = TOP + rows.length * ROW
  const height = axisY + (threshold ? 46 : 30)

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      <text x={LABEL_X} y="16" textAnchor="end" fill={C.label} fontSize="11.5">{yTitle}</text>
      <text x={(X0 + x1) / 2} y="16" textAnchor="middle" fill={C.label} fontSize="11.5">{xTitle}</text>
      {side && <text x={sideX0} y="16" fill={C.label} fontSize="11.5">{side.title}</text>}

      {ticks.map((t) => (
        <g key={t}>
          <line x1={X0 + sx(t)} x2={X0 + sx(t)} y1="26" y2={axisY} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 5" />
          <text x={X0 + sx(t)} y={axisY + 18} textAnchor="middle" fill="#C9DAE6" fontSize="11.5" className="num">{randTick(t)}</text>
        </g>
      ))}

      {rows.map((r, i) => {
        const rowTop = TOP + i * ROW
        const n = r.bars.length
        const startY = rowTop + (ROW - (n * bh + (n - 1) * 2)) / 2
        const selected = r.key === selectedKey
        const pick = onSelect && !r.none ? () => onSelect(r.key) : undefined
        return (
          <g key={r.key} className={pick ? 'chart-row' : undefined} onClick={pick}>
            <rect x="8" y={rowTop} width={W - 16} height={ROW} rx="6" fill={selected ? 'rgba(193,176,129,0.10)' : 'rgba(255,255,255,0)'}>
              {pick && <title>{`${r.label}${r.sub ? ' ' + r.sub : ''} — click for figures`}</title>}
            </rect>
            <line x1="12" x2={W - 12} y1={rowTop + ROW} y2={rowTop + ROW} stroke="rgba(255,255,255,0.05)" />
            <text x={LABEL_X} y={rowTop + (r.sub ? 15 : 21)} textAnchor="end" fill={C.text} fontSize="12.5">{r.label}</text>
            {r.sub && <text x={LABEL_X} y={rowTop + 28} textAnchor="end" fill={C.label} fontSize="10.5">{r.sub}</text>}

            {r.none ? (
              <text x={X0 + 10} y={rowTop + 21} fill={C.label} fontSize="11.5">{r.none}</text>
            ) : r.bars.map((b, j) => {
              const y = startY + j * (bh + 2)
              const w = sx(b.value)
              return (
                <g key={j}>
                  <rect x={X0} y={y} width={Math.max(w, b.value > 0 ? 2 : 0)} height={bh} rx="3" fill={b.color} stroke={b.stroke || 'none'} strokeWidth="1.5">
                    {b.tip && <title>{b.tip}</title>}
                  </rect>
                  <text x={X0 + w + 6} y={y + bh - 2} fill={b.textColor || '#C9DAE6'} fontSize="10.5" fontWeight={b.bold ? 700 : 400} className="num">
                    {b.text ?? formatValue(b.value)}
                  </text>
                </g>
              )
            })}

            {side && r.side && !r.none && (() => {
              const w = Math.max(2, (Math.abs(r.side.value) / sideMax) * sideW)
              return (
                <g>
                  <rect x={sideX0} y={rowTop + 11} width={w} height="12" rx="3" fill={side.color}>{r.side.tip && <title>{r.side.tip}</title>}</rect>
                  <text x={sideX0 + w + 6} y={rowTop + 21} fill={C.text} fontSize="11" className="num">{r.side.text}</text>
                </g>
              )
            })()}
          </g>
        )
      })}

      {threshold && (
        <g>
          <line x1={X0 + sx(threshold.value)} x2={X0 + sx(threshold.value)} y1="26" y2={axisY} stroke={threshold.color} strokeWidth="1.4" strokeDasharray="6 5" />
          <text x={X0 + sx(threshold.value)} y={axisY + 36} textAnchor="middle" fill="#C9DAE6" fontSize="11">{threshold.label}</text>
        </g>
      )}
      <line x1={X0} x2={X0} y1="26" y2={axisY} stroke="rgba(255,255,255,0.3)" />
      <line x1={X0} x2={x1} y1={axisY} y2={axisY} stroke="rgba(255,255,255,0.3)" />
      {side && <line x1={sideX0} x2={sideX0} y1="26" y2={axisY} stroke="rgba(255,255,255,0.3)" />}
    </svg>
  )
}

export function Legend({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: C.soft }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: it.color }} />{it.label}
        </span>
      ))}
    </div>
  )
}
