import { C, INSET } from '../../lib/theme'

export const inputStyle = {
  width: '100%', minHeight: 40, padding: '9px 12px', borderRadius: 10, fontSize: 14, color: C.text,
  background: INSET, border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'inherit',
}

/** A labelled form field; the label wraps its input so screen readers and tests can find it by name. */
export function Field({ label, hint, children, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', fontSize: 12, color: C.label, marginBottom: 5, letterSpacing: 0.3 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: C.label, marginTop: 4 }}>{hint}</span>}
    </label>
  )
}

export function Notice({ kind = 'ok', children }) {
  const color = kind === 'error' ? C.danger : C.frank
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} style={{ padding: '10px 14px', borderRadius: 12, background: `${color}14`, border: `1px solid ${color}44`, color: C.text, fontSize: 14 }}>
      {children}
    </div>
  )
}
