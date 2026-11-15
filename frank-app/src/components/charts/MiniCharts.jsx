import { C } from '../../lib/theme'

/** Tiny trend line for a KPI card. Decorative: the card text carries the value. */
export function Sparkline({ values, color = C.frank }) {
  const vals = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]
  const mx = Math.max(...vals), mn = Math.min(...vals), W = 160, H = 34
  const pts = vals.map((v, i) => [i * (W / (vals.length - 1)), 2 + (H - 4) * (1 - (v - mn) / ((mx - mn) || 1))])
  const line = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')
  return (
    <svg viewBox={`0 0 ${W} 36`} width="100%" height="36" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`${color}1f`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Share-of-total ring. segments: [{ name, value, color }] in fixed palette order. */
export function Donut({ segments, centre, centreSub, size = 170 }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  const R = 64, CIRC = 2 * Math.PI * R
  let acc = 0
  const label = segments.map((s) => `${s.name} ${Math.round((s.value / total) * 100)} percent`).join(', ')
  return (
    <svg viewBox="0 0 180 180" width={size} height={size} role="img" aria-label={`Donut chart: ${label}`}>
      <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="22" />
      {segments.map((s) => {
        const len = (s.value / total) * CIRC, gap = segments.length > 1 ? 2.5 : 0
        const el = (
          <circle key={s.name} cx="90" cy="90" r={R} fill="none" stroke={s.color} strokeWidth="22"
            strokeDasharray={`${Math.max(0, len - gap)} ${CIRC - len + gap}`} strokeDashoffset={-acc} transform="rotate(-90 90 90)">
            <title>{`${s.name}: R ${s.value.toLocaleString('en-ZA')}`}</title>
          </circle>
        )
        acc += len
        return el
      })}
      <text x="90" y="86" textAnchor="middle" fill={C.bright} fontSize="20" fontWeight="600" className="num">{centre}</text>
      <text x="90" y="106" textAnchor="middle" fill={C.label} fontSize="11">{centreSub}</text>
    </svg>
  )
}

/** 0–100 score ring. */
export function ScoreRing({ score, size = 132 }) {
  const R = 56, CIRC = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={`Score ${score} out of 100`}>
      <defs>
        <linearGradient id="scoreRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.gold} />
          <stop offset="1" stopColor={C.frank} />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
      <circle cx="70" cy="70" r={R} fill="none" stroke="url(#scoreRingGrad)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * CIRC} ${CIRC}`} transform="rotate(-90 70 70)" />
      <text x="70" y="74" textAnchor="middle" fill={C.bright} fontSize="30" fontWeight="600" className="num">{score}</text>
      <text x="70" y="94" textAnchor="middle" fill={C.label} fontSize="11">out of 100</text>
    </svg>
  )
}
