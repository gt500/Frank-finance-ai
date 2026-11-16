import { Component } from 'react'
import { LEGAL } from '../pages/legalContent'

/** Last line of defence: a crash shows a plain message and a way back, never a blank page. */
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error, info) { console.error('Screen crashed:', error, info?.componentStack) }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" style={{ minHeight: '100vh', background: '#000', color: '#E8F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Century Gothic','Trebuchet MS',sans-serif" }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 10px' }}>Something went wrong</h1>
          <p style={{ color: '#B7CCDB', lineHeight: 1.6, margin: '0 0 20px' }}>
            Your information is safe. Please reload the page. If it happens again, email <a href={`mailto:${LEGAL.email}`} style={{ color: '#20e5f6' }}>{LEGAL.email}</a>.
          </p>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: '0 22px', borderRadius: 8, border: 'none', background: '#20e5f6', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Reload</button>
        </div>
      </div>
    )
  }
}
