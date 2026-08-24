import { C, fmt } from '../../lib/theme'

export function Card({ title, sub, children, style = {} }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '18px', ...style }}>
      {(title || sub) && (
        <div style={{ marginBottom: 14 }}>
          {title && <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{title}</div>}
          {sub   && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{sub}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function SLabel({ children }) {
  return (
    <div style={{ fontSize: 12, letterSpacing: 2.5, color: C.sub, textTransform: 'uppercase', marginBottom: 9 }}>
      {children}
    </div>
  )
}

export function StatBox({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick}
      className={onClick ? 'hover-card' : ''}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `2px solid ${color}`, borderRadius: 6, padding: '15px 16px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 12, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 800, color, letterSpacing: '-0.3px', marginBottom: 3, fontFamily: 'var(--mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.dim }}>{sub}</div>}
    </div>
  )
}

export function Alert({ color, icon = '⚠', children, onAsk }) {
  return (
    <div style={{ padding: '11px 16px', background: `${color}10`, border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ color, fontSize: 16, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{children}</span>
      </div>
      {onAsk && (
        <button onClick={onAsk} style={{ fontSize: 12, color, background: 'transparent', border: `1px solid ${color}44`, borderRadius: 4, padding: '3px 11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Ask Zeeder
        </button>
      )}
    </div>
  )
}

export function Badge({ label, color, size = 'md' }) {
  const padding = size === 'sm' ? '2px 6px' : '3px 9px'
  const fontSize = size === 'sm' ? 11 : 12
  return (
    <span style={{ fontSize, padding, borderRadius: 3, background: `${color}20`, color, border: `1px solid ${color}44`, letterSpacing: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export function RiskDot({ risk }) {
  const color = risk === 'high' ? C.danger : risk === 'med' ? C.warn : C.frank
  return <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

export function ConfBadge({ value }) {
  const color = value === 'high' ? C.frank : value === 'medium' ? C.warn : value === 'low' ? C.danger : C.dim
  return <Badge label={value || '?'} color={color} size="sm" />
}

export function Spinner({ color = C.frank, size = 22 }) {
  return (
    <div className="spin" style={{ width: size, height: size, border: `2px solid ${C.border}`, borderTop: `2px solid ${color}`, borderRadius: '50%' }} />
  )
}

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '11px 16px', fontSize: 13, minWidth: 150 }}>
      <div style={{ color: C.sub, marginBottom: 7, fontWeight: 600, fontSize: 15 }}>{label}</div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: p.color || C.text, marginBottom: 3, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span>{p.name}</span>
          <strong>{typeof p.value === 'number' ? fmt(Math.abs(p.value)) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function Empty({ message = 'No data yet' }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.sub, fontSize: 17 }}>
      {message}
    </div>
  )
}

export function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 11, marginBottom: 16, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.frankDim, border: `1px solid ${C.frank}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.frank, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>
          f
        </div>
      )}
      <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: isUser ? '12px 12px 3px 12px' : '3px 12px 12px 12px', background: isUser ? `${C.frank}15` : C.card, border: `1px solid ${isUser ? C.frank + '44' : C.border}`, fontSize: 15, lineHeight: 1.8, color: C.text, whiteSpace: 'pre-wrap' }}>
        {message.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} style={{ color: C.frank }}>{part.slice(2, -2)}</strong>
            : part
        )}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 11, marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.frankDim, border: `1px solid ${C.frank}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.frank, fontWeight: 800 }}>f</div>
      <div style={{ padding: '13px 17px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '3px 12px 12px 12px', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(d => (
          <div key={d} className="blink" style={{ width: 6, height: 6, borderRadius: '50%', background: C.frank, animationDelay: `${d * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}
