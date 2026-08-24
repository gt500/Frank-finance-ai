import { C, FONT_BODY, FONT_SUB } from '../lib/theme'

const S = {
  // Layout
  page: {
    background: C.bg,
    color: C.text,
    fontFamily: FONT_BODY,
    minHeight: '100vh',
    overflowX: 'hidden',
  },

  // ── HERO ──
  hero: {
    minHeight: '100vh',
    background: `radial-gradient(ellipse 80% 60% at 50% -10%, #0d2a4a 0%, ${C.bg} 70%)`,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 48px',
    borderBottom: `1px solid ${C.border}22`,
    flexShrink: 0,
  },
  navLogo: {
    fontSize: 22,
    fontWeight: 800,
    fontFamily: FONT_BODY,
    color: C.frank,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  navSub: {
    fontFamily: FONT_SUB,
    fontSize: 10,
    color: C.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  navButtons: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  btnSignIn: {
    padding: '8px 20px',
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.sub,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    letterSpacing: 0.5,
  },
  btnStart: {
    padding: '8px 20px',
    background: C.frank,
    border: 'none',
    borderRadius: 4,
    color: C.bg,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.5,
  },

  heroBody: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    padding: '60px 48px 80px',
    gap: 60,
    flexWrap: 'wrap',
  },
  heroLeft: {
    flex: '1 1 480px',
    maxWidth: 620,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    color: C.frank,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: C.frank,
    animation: 'pulse 2s ease-in-out infinite',
  },
  h1: {
    fontSize: 56,
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.08,
    letterSpacing: -1,
    marginBottom: 24,
  },
  h1Accent: {
    color: C.frank,
  },
  subHeadline: {
    fontSize: 18,
    color: C.sub,
    lineHeight: 1.65,
    marginBottom: 36,
    maxWidth: 500,
  },
  ctaRow: {
    display: 'flex',
    gap: 14,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  btnPrimary: {
    padding: '14px 28px',
    background: C.frank,
    border: 'none',
    borderRadius: 5,
    color: C.bg,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },
  btnOutline: {
    padding: '14px 28px',
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    color: C.text,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },
  trustLine: {
    fontSize: 12,
    color: C.dim,
    letterSpacing: 0.3,
  },

  // ── HERO CARD MOCKUP ──
  heroRight: {
    flex: '1 1 300px',
    maxWidth: 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '32px 36px',
    width: '100%',
    boxShadow: `0 0 60px ${C.frank}18, 0 0 120px ${C.frank}08`,
    position: 'relative',
  },
  mockLabel: {
    fontSize: 11,
    color: C.sub,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  mockBalance: {
    fontSize: 44,
    fontWeight: 800,
    color: C.frank,
    fontFamily: 'monospace',
    letterSpacing: -1,
    textShadow: `0 0 30px ${C.frank}60`,
    marginBottom: 4,
  },
  mockBalanceSub: {
    fontSize: 12,
    color: C.dim,
    marginBottom: 28,
  },
  mockDivider: {
    height: 1,
    background: C.border,
    marginBottom: 20,
  },
  mockRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mockRowLabel: {
    fontSize: 13,
    color: C.sub,
  },
  mockRowVal: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  mockAlert: {
    marginTop: 20,
    padding: '10px 14px',
    background: `${C.frank}10`,
    border: `1px solid ${C.frank}30`,
    borderRadius: 6,
    fontSize: 12,
    color: C.frank,
  },

  // ── PROBLEM STRIP ──
  problemStrip: {
    background: C.card,
    borderTop: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
    padding: '64px 48px',
  },
  problemGrid: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    gap: 0,
    flexWrap: 'wrap',
  },
  problemCol: {
    flex: '1 1 280px',
    padding: '0 32px',
    borderRight: `1px solid ${C.border}`,
  },
  problemColLast: {
    flex: '1 1 280px',
    padding: '0 32px',
  },
  problemIcon: {
    fontSize: 24,
    marginBottom: 16,
  },
  problemTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  problemText: {
    fontSize: 14,
    color: C.sub,
    lineHeight: 1.65,
  },

  // ── SECTION HEADER ──
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: C.frank,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 16,
    color: C.sub,
    lineHeight: 1.6,
    maxWidth: 520,
  },

  // ── FEATURES GRID ──
  featuresSection: {
    padding: '80px 48px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  featuresHeader: {
    marginBottom: 48,
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 20,
  },
  featureCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '28px 28px',
    transition: 'border-color 0.2s',
  },
  featureEmoji: {
    fontSize: 28,
    marginBottom: 14,
    display: 'block',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  featureText: {
    fontSize: 14,
    color: C.sub,
    lineHeight: 1.6,
  },

  // ── QUOTE BLOCK ──
  quoteSection: {
    background: `linear-gradient(180deg, ${C.bg} 0%, #071424 50%, ${C.bg} 100%)`,
    padding: '100px 48px',
    textAlign: 'center',
  },
  quoteInner: {
    maxWidth: 760,
    margin: '0 auto',
  },
  quoteBar: {
    width: 40,
    height: 3,
    background: C.frank,
    margin: '0 auto 32px',
    borderRadius: 2,
  },
  quoteText: {
    fontSize: 28,
    fontWeight: 700,
    color: '#FFFFFF',
    lineHeight: 1.45,
    letterSpacing: -0.5,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  quoteAccent: {
    color: C.frank,
    fontStyle: 'normal',
  },
  quoteSub: {
    fontSize: 15,
    color: C.sub,
    lineHeight: 1.6,
  },

  // ── PRICING ──
  pricingSection: {
    padding: '80px 48px',
    background: C.card,
    borderTop: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
  },
  pricingInner: {
    maxWidth: 1100,
    margin: '0 auto',
  },
  pricingHeader: {
    textAlign: 'center',
    marginBottom: 48,
  },
  pricingGrid: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pricingCard: {
    flex: '1 1 280px',
    maxWidth: 340,
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
  },
  pricingCardFeatured: {
    flex: '1 1 280px',
    maxWidth: 340,
    background: C.bg,
    border: `1px solid ${C.frank}60`,
    borderRadius: 10,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: `0 0 40px ${C.frank}12`,
    position: 'relative',
  },
  pricingBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: C.frank,
    color: C.bg,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    padding: '4px 14px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
  },
  pricingTier: {
    fontSize: 12,
    fontWeight: 700,
    color: C.frank,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  pricingAmount: {
    fontSize: 40,
    fontWeight: 800,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: -1,
    marginBottom: 4,
  },
  pricingPer: {
    fontSize: 13,
    color: C.dim,
    marginBottom: 20,
  },
  pricingFeature: {
    fontSize: 14,
    color: C.sub,
    lineHeight: 1.6,
    flex: 1,
    marginBottom: 24,
  },
  btnPricingCta: {
    padding: '12px',
    background: C.frank,
    border: 'none',
    borderRadius: 5,
    color: C.bg,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    letterSpacing: 0.3,
  },
  btnPricingCtaOutline: {
    padding: '12px',
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    color: C.text,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    letterSpacing: 0.3,
  },

  // ── FOOTER ──
  footer: {
    padding: '36px 48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    borderTop: `1px solid ${C.border}`,
  },
  footerLogo: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: 800,
    color: C.frank,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  footerSub: {
    fontFamily: FONT_SUB,
    fontSize: 11,
    color: C.gold,
    marginTop: 4,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  footerRight: {
    fontSize: 12,
    color: C.dim,
    textAlign: 'right',
    lineHeight: 1.6,
  },
}

const FEATURES = [
  {
    emoji: '💰',
    title: 'Live Cash Balance',
    text: 'See your exact bank balance updated daily. Know before payday if you\'re short.',
  },
  {
    emoji: '📈',
    title: '13-Week Cash Forecast',
    text: 'See exactly when your cash will be tight — weeks before it happens.',
  },
  {
    emoji: '🤖',
    title: 'Zeeder AI Assistant',
    text: 'Ask questions in plain English. "Can I afford to hire someone next month?" — Zeeder answers.',
  },
  {
    emoji: '📄',
    title: 'Document Intelligence',
    text: 'Upload your bank statement, invoices, or payroll report. Zeeder reads it and tells you what matters.',
  },
  {
    emoji: '⚡',
    title: 'Exception-Driven Alerts',
    text: 'Zeeder tells you what needs action today. Not a wall of numbers — a prioritised action list.',
  },
  {
    emoji: '🏦',
    title: 'Bank Connected',
    text: 'Live bank data. No manual entry. Your numbers are always current.',
  },
]

const PRICING = [
  {
    tier: 'Starter',
    amount: 'R 499',
    per: '/month',
    feature: 'Live cash visibility + invoice tracking',
    featured: false,
  },
  {
    tier: 'Growth',
    amount: 'R 999',
    per: '/month',
    feature: 'Everything + AI assistant + document intelligence',
    featured: true,
  },
  {
    tier: 'Pro',
    amount: 'R 1,999',
    per: '/month',
    feature: 'Everything + reconciliation + multi-user + approvals',
    featured: false,
  },
]

export function Landing({ onEnterApp }) {
  return (
    <div style={S.page}>

      {/* ── HERO ── */}
      <section style={S.hero}>
        {/* Nav */}
        <nav style={S.nav}>
          <div>
            <div style={S.navLogo}>ZEEDER</div>
            <div style={S.navSub}>Finance OS</div>
          </div>
          <div style={S.navButtons}>
            <button style={S.btnSignIn} onClick={onEnterApp}>Sign In</button>
            <button style={S.btnStart} onClick={onEnterApp}>Start Free</button>
          </div>
        </nav>

        {/* Hero Body */}
        <div style={S.heroBody}>
          <div style={S.heroLeft}>
            <div style={S.eyebrow}>
              <div style={S.eyebrowDot} />
              Finance Operating System
            </div>
            <h1 style={S.h1}>
              Real-Time Cash Control{' '}
              <span style={S.h1Accent}>for Small Business</span>
            </h1>
            <p style={S.subHeadline}>
              Stop guessing. See your exact cash position, who owes you money, and what bills are due — updated daily, explained in plain English.
            </p>
            <div style={S.ctaRow}>
              <button style={S.btnPrimary} onClick={onEnterApp}>Start Free Trial</button>
              <button style={S.btnOutline}>Watch Demo</button>
            </div>
            <div style={S.trustLine}>
              No accounting knowledge needed · No setup fees · Cancel anytime
            </div>
          </div>

          {/* Mock card */}
          <div style={S.heroRight}>
            <div style={S.mockCard}>
              <div style={S.mockLabel}>Cash Position · Today</div>
              <div style={S.mockBalance}>R 61,400</div>
              <div style={S.mockBalanceSub}>Updated 07:42 this morning</div>
              <div style={S.mockDivider} />
              <div style={S.mockRow}>
                <span style={S.mockRowLabel}>Owed to you</span>
                <span style={{ ...S.mockRowVal, color: C.frank }}>R 34,200</span>
              </div>
              <div style={S.mockRow}>
                <span style={S.mockRowLabel}>Bills due this week</span>
                <span style={{ ...S.mockRowVal, color: C.warn }}>R 18,500</span>
              </div>
              <div style={S.mockRow}>
                <span style={S.mockRowLabel}>Payroll in 8 days</span>
                <span style={{ ...S.mockRowVal, color: C.danger }}>R 94,500</span>
              </div>
              <div style={S.mockAlert}>
                ⚡ Collect 2 overdue invoices before the 25th to cover payroll
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM STRIP ── */}
      <section style={S.problemStrip}>
        <div style={S.problemGrid}>
          <div style={S.problemCol}>
            <div style={S.problemIcon}>📊</div>
            <div style={S.problemTitle}>Spreadsheets lie</div>
            <div style={S.problemText}>
              Bank statements tell you what happened. They don't tell you what's coming.
            </div>
          </div>
          <div style={S.problemCol}>
            <div style={S.problemIcon}>📅</div>
            <div style={S.problemTitle}>Month-end is too late</div>
            <div style={S.problemText}>
              By the time your accountant sends the report, the crisis already happened.
            </div>
          </div>
          <div style={S.problemColLast}>
            <div style={S.problemIcon}>🔤</div>
            <div style={S.problemTitle}>Jargon blocks action</div>
            <div style={S.problemText}>
              AR, AP, EBITDA — if you need a dictionary, the dashboard isn't working for you.
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section>
        <div style={S.featuresSection}>
          <div style={S.featuresHeader}>
            <div style={S.sectionLabel}>What Zeeder does differently</div>
            <div style={S.sectionTitle}>Built for operators, not accountants</div>
            <div style={S.sectionSub}>
              Every feature is designed around one question: what do you need to know to run your business today?
            </div>
          </div>
          <div style={S.featureGrid}>
            {FEATURES.map(f => (
              <div key={f.title} style={S.featureCard}>
                <span style={S.featureEmoji}>{f.emoji}</span>
                <div style={S.featureTitle}>{f.title}</div>
                <div style={S.featureText}>{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POSITIONING QUOTE ── */}
      <section style={S.quoteSection}>
        <div style={S.quoteInner}>
          <div style={S.quoteBar} />
          <div style={S.quoteText}>
            "This is not accounting software.{' '}
            <span style={S.quoteAccent}>It's the daily operating console</span>{' '}
            your business has always needed."
          </div>
          <div style={S.quoteSub}>
            Built for owners who run their business, not accountants who report on it.
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={S.pricingSection}>
        <div style={S.pricingInner}>
          <div style={S.pricingHeader}>
            <div style={S.sectionLabel}>Simple Pricing</div>
            <div style={S.sectionTitle}>Start free. No surprises.</div>
            <div style={{ ...S.sectionSub, margin: '0 auto', textAlign: 'center' }}>
              14-day free trial on all plans. No credit card required to start.
            </div>
          </div>
          <div style={S.pricingGrid}>
            {PRICING.map(p => (
              <div key={p.tier} style={p.featured ? S.pricingCardFeatured : S.pricingCard}>
                {p.featured && <div style={S.pricingBadge}>Most Popular</div>}
                <div style={S.pricingTier}>{p.tier}</div>
                <div style={S.pricingAmount}>{p.amount}</div>
                <div style={S.pricingPer}>{p.per}</div>
                <div style={S.pricingFeature}>{p.feature}</div>
                <button
                  style={p.featured ? S.btnPricingCta : S.btnPricingCtaOutline}
                  onClick={onEnterApp}
                >
                  Start Free Trial
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={S.footer}>
        <div>
          <div style={S.footerLogo}>ZEEDER</div>
          <div style={S.footerSub}>Finance OS</div>
        </div>
        <div style={S.footerRight}>
          <div>© 2026 Zeeder Finance OS</div>
          <div style={{ marginTop: 4, fontStyle: 'italic' }}>
            Not accounting software. A finance operating system.
          </div>
        </div>
      </footer>
    </div>
  )
}
