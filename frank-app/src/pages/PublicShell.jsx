import '../styles/public.css'
import { LEGAL } from './legalContent'

/** Header, skip link, main landmark and footer shared by the landing page and the legal pages. */
export function PublicShell({ children, onHome, onSignIn, onStart }) {
  return (
    <div className="pub">
      <a className="pub-skip" href="#main">Skip to content</a>
      <header className="pub-header">
        <a className="pub-brand" href="/" onClick={(e) => { if (onHome) { e.preventDefault(); onHome() } }} aria-label="Zeeder Finance OS home">
          ZEEDER <span>Finance OS</span>
        </a>
        <nav className="pub-nav" aria-label="Main">
          {onSignIn && <button type="button" className="pub-btn pub-btn-ghost" onClick={onSignIn}>Sign in</button>}
          {onStart && <button type="button" className="pub-btn pub-btn-primary" onClick={() => onStart()}>Start free trial</button>}
        </nav>
      </header>
      <main id="main" tabIndex="-1">{children}</main>
      <footer className="pub-footer">
        <div className="pub-footer-grid">
          <div>
            <div className="pub-footer-brand">ZEEDER <span>Finance OS</span></div>
            <p>Cash, debtors, creditors, invoices and financial statements for South African small businesses.</p>
          </div>
          <nav aria-label="Legal and contact">
            <ul>
              <li><a href="/privacy">Privacy notice</a></li>
              <li><a href="/terms">Terms of use</a></li>
              <li><a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></li>
            </ul>
          </nav>
        </div>
        <p className="pub-footer-small">
          We follow the Protection of Personal Information Act (POPIA). Prices are in rand a month. {'©'} 2026 {LEGAL.product}.
        </p>
      </footer>
    </div>
  )
}
