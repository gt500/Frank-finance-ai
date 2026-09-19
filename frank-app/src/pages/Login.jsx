import { useState } from 'react'
import { C, FONT_BODY } from '../lib/theme'

function inputStyle(hasError = false) {
  return {
    width: '100%', padding: '11px 14px', borderRadius: 6,
    border: `1px solid ${hasError ? C.danger : C.border}`,
    background: C.bg, color: C.text, fontSize: 14,
    outline: 'none', fontFamily: FONT_BODY, boxSizing: 'border-box',
  }
}

export function Login({ onLogin, onStartOnboarding }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await onLogin(email.trim().toLowerCase(), password)
    if (!result.ok) setError(result.error)
    setLoading(false)
  }

  function fillDemo(em, pw) { setEmail(em); setPassword(pw); setError('') }

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${C.card} 0%, ${C.bg} 70%)`,
      display: 'flex', fontFamily: FONT_BODY,
    }}>

      {/* ── Left: Branding ─────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 80px',
        borderRight: `1px solid ${C.border}22`,
      }}>
        <div style={{ marginBottom: 48 }}>
          <img src="/zeeder-logo.png" alt="Zeeder AI" style={{ height: 320, display: 'block' }} />
        </div>

        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, lineHeight: 1.35, marginBottom: 20, maxWidth: 440 }}>
          Your business finances,<br />
          <span style={{ color: C.frank }}>finally under control.</span>
        </div>

        <div style={{ fontSize: 15, color: C.sub, lineHeight: 1.9, maxWidth: 400, marginBottom: 40 }}>
          Real-time cash flow, debtors, creditors, and AI-powered insights — built for South African businesses.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            ['⇌', 'Bank statement reconciliation in seconds'],
            ['◉', 'Ask Zeeder anything about your finances'],
            ['▦', 'Live dashboard updated from your real data'],
            ['↑', 'AI extraction from any document type'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16, color: C.frank, width: 20, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 14, color: C.sub }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Login form ──────────────────────────── */}
      <div style={{
        width: 500, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '40px 52px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 6 }}>Sign in</div>
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 32 }}>Access your finance dashboard</div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: C.dim, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                Email address
              </label>
              <input
                type="email" value={email} autoFocus required
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@business.co.za"
                style={inputStyle(!!error)}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: C.dim, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                Password
              </label>
              <input
                type="password" value={password} required
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                style={inputStyle(!!error)}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: `${C.danger}10`, border: `1px solid ${C.danger}30`, borderRadius: 6, fontSize: 13, color: C.danger }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              padding: '13px', borderRadius: 6, border: 'none',
              background: C.frank, color: '#000', fontSize: 14, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 1,
              textTransform: 'uppercase', opacity: loading ? 0.7 : 1, fontFamily: FONT_BODY,
            }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 28, paddingTop: 28, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>New to Zeeder?</div>
            <button onClick={onStartOnboarding} style={{
              width: '100%', padding: '12px', borderRadius: 6,
              border: `1px solid ${C.frank}40`, background: 'transparent',
              color: C.frank, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              letterSpacing: 0.5, fontFamily: FONT_BODY,
            }}>
              Start your free trial →
            </button>
          </div>

          {/* Demo credentials */}
          <div style={{ marginTop: 28, padding: '16px', background: `${C.frank}06`, border: `1px solid ${C.frank}15`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: C.dim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Demo account — click to fill
            </div>
            <div
              onClick={() => fillDemo('admin@capefresh.co.za', 'capefresh2025')}
              style={{ padding: '8px 10px', borderRadius: 5, background: C.bg, cursor: 'pointer', border: `1px solid ${C.border}` }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 2 }}>Cape Fresh Grocery</div>
              <div style={{ fontSize: 11, color: C.dim }}>admin@capefresh.co.za · capefresh2025</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
