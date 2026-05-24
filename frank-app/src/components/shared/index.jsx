import { C, fmt, fmtK } from '../../lib/theme'

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export function Card({ title, sub, children, style = {} }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '14px', ...style }}>
      {(title || sub) && (
        <div style={{ marginBottom: 12 }}>
          {title && <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{title}</div>}
          {sub   && <div style={{ fontSize: 9,  color: C.muted, marginTop: 2 }}>{sub}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
export function SLabel({ children }) {
  return (
    <div style={{ fontSize: 8, letterSpacing: 3, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  )
}

// ─── KPI stat box ─────────────────────────────────────────────────────────────
export function StatBox({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick}
      className={onClick ? 'hover-card' : ''}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `2px solid ${color}`, borderRadius: 6, padding: '11px 12px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 8, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.3px', marginBottom: 2, fontFamily: 'var(--mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.muted }}>{sub}</div>}
    </div>
  )
}

// ─── Alert banner ─────────────────────────────────────────────────────────────
export function Alert({ color, icon = '⚠', children, onAsk }) {
  return (
    <div style={{ padding: '8px 14px', background: `${color}10`, border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color, fontSize: 11, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 10, color: '#CCC', lineHeight: 1.5 }}>{children}</span>
      </div>
      {onAsk && (
        <button onClick={onAsk} style={{ fontSize: 9, color, background: 'transparent', border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 9px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Ask Frank
        </button>
      )}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ label, color, size = 'md' }) {
  const padding = size === 'sm' ? '1px 5px' : '2px 7px'
  const fontSize = size === 'sm' ? 8 : 9
  return (
    <span style={{ fontSize, padding, borderRadius: 3, background: `${color}20`, color, border: `1px solid ${color}44`, letterSpacing: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

// ─── Risk dot ─────────────────────────────────────────────────────────────────
export function RiskDot({ risk }) {
  const color = risk === 'high' ? C.danger : risk === 'med' ? C.warn : C.frank
  return <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
export function ConfBadge({ value }) {
  const color = value === 'high' ? C.frank : value === 'medium' ? C.warn : value === 'low' ? C.danger : C.muted
  return <Badge label={value || '?'} color={color} size="sm" />
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ color = C.frank, size = 18 }) {
  return (
    <div className="spin" style={{ width: size, height: size, border: `2px solid ${C.muted}`, borderTop: `2px solid ${color}`, borderRadius: '50%' }} />
  )
}

// ─── Tooltip (recharts custom) ────────────────────────────────────────────────
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0D1628', border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 10, minWidth: 130 }}>
      <div style={{ color: C.sub, marginBottom: 6, fontWeight: 600, fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: p.color || C.text, marginBottom: 2, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{p.name}</span>
          <strong>{typeof p.value === 'number' ? fmt(Math.abs(p.value)) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function Empty({ message = 'No data yet' }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted, fontSize: 12 }}>
      {message}
    </div>
  )
}

// ─── Chat message ─────────────────────────────────────────────────────────────
export function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 9, marginBottom: 13, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--frank-dim)', border: `1px solid ${C.frank}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.frank, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>
          f
        </div>
      )}
      <div style={{ maxWidth: '78%', padding: '9px 12px', borderRadius: isUser ? '12px 12px 3px 12px' : '3px 12px 12px 12px', background: isUser ? `${C.frank}15` : C.card, border: `1px solid ${isUser ? C.frank + '44' : C.border}`, fontSize: 11, lineHeight: 1.75, color: C.text, whiteSpace: 'pre-wrap' }}>
        {message.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} style={{ color: C.frank }}>{part.slice(2, -2)}</strong>
            : part
        )}
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
export function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 9, marginBottom: 13 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--frank-dim)', border: `1px solid ${C.frank}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.frank, fontWeight: 800 }}>f</div>
      <div style={{ padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '3px 12px 12px 12px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(d => (
          <div key={d} className="blink" style={{ width: 4, height: 4, borderRadius: '50%', background: C.frank, animationDelay: `${d * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}
