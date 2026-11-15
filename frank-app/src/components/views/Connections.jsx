import { useState } from 'react'
import { C, GLASS, INSET } from '../../lib/theme'
import { MailSettings } from './MailSettings'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function StatusDot({ status }) {
  const colors = { live: C.frank, error: C.warn, off: C.dim, soon: C.dim }
  const labels = { live: 'Live', error: 'Error', off: 'Not connected', soon: 'Coming soon' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: colors[status], fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{labels[status]}</span>
    </div>
  )
}

function CardShell({ icon, name, status, children }) {
  return (
    <div style={{ ...GLASS, borderRadius: 8, padding: '18px 20px',
      border: `1px solid ${status === 'live' ? C.frank + '33' : C.border}`,
      borderLeft: `3px solid ${status === 'live' ? C.frank : status === 'error' ? C.warn : C.dim}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{name}</div>
            <StatusDot status={status} />
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

function Detail({ status, children }) {
  if (!children) return null
  return (
    <div style={{ fontSize: 11, color: status === 'error' ? C.warn : C.frank,
      background: status === 'error' ? `${C.warn}10` : `${C.frank}08`,
      border: `1px solid ${status === 'error' ? C.warn + '33' : C.frank + '22'}`,
      borderRadius: 4, padding: '5px 10px', marginBottom: 8 }}>{children}</div>
  )
}

function AskButton({ onAsk, askQ }) {
  if (!askQ) return null
  return (
    <button onClick={() => onAsk(askQ)} style={{ marginTop: 4, padding: '5px 12px', borderRadius: 4, border: `1px solid ${C.frank}33`, background: C.frankDim, color: C.frank, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Ask Zeeder →</button>
  )
}

function ConnCard({ icon, name, desc, status, detail, onAsk, askQ }) {
  return (
    <CardShell icon={icon} name={name} status={status}>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: detail ? 8 : 0 }}>{desc}</div>
      <Detail status={status}>{detail}</Detail>
      <AskButton onAsk={onAsk} askQ={askQ} />
    </CardShell>
  )
}

function SimplePayCard({ payrollData, payrollLoading, payrollError, simplePayConnected, connectSimplePay, disconnectSimplePay, onAsk }) {
  const [keyInput, setKeyInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [formError, setFormError] = useState(null)

  const connected = simplePayConnected
  const payrollOk = connected && (payrollData?.employees != null || payrollData?.payRuns != null)
  const status = !connected ? 'off' : payrollLoading ? 'soon' : payrollOk ? 'live' : 'error'

  async function handleConnect() {
    setFormError(null); setConnecting(true)
    const result = await connectSimplePay(keyInput)
    setConnecting(false)
    if (!result.ok) setFormError(result.error)
    else setKeyInput('')
  }

  return (
    <CardShell icon="👥" name="SimplePay Payroll" status={status}>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 8 }}>
        Pulls live employee records and pay run history from SimplePay (SA). Used to monitor salary costs and payroll dates.
      </div>
      {connected ? (
        <>
          <Detail status={status}>
            {payrollLoading ? 'Connecting...' :
             payrollOk ? `${payrollData?.employees?.length ?? '—'} employees · ${payrollData?.payRuns?.length ?? '—'} pay runs` :
             `Connection failed: ${payrollError ?? 'unknown error'}`}
          </Detail>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AskButton onAsk={onAsk} askQ={payrollOk ? 'Summarise the payroll data — headcount, total salary cost, and next pay date' : null} />
            {formError && <span style={{ fontSize: 11, color: C.warn }}>{formError}</span>}
            <button onClick={async () => { setFormError(null); const r = await disconnectSimplePay(); if (!r.ok) setFormError(r.error) }} style={{ marginTop: 4, padding: '5px 12px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Disconnect</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !connecting && handleConnect()}
              placeholder="Paste your SimplePay API key"
              style={{ flex: 1, padding: '7px 10px', borderRadius: 4, border: `1px solid ${formError ? C.warn : C.border}`, background: INSET, color: C.text, fontSize: 12, outline: 'none', fontFamily: 'var(--mono)' }} />
            <button onClick={handleConnect} disabled={connecting || !keyInput.trim()}
              style={{ padding: '7px 14px', borderRadius: 4, border: `1px solid ${C.frank}33`, background: C.frankDim, color: C.frank, cursor: connecting ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, opacity: connecting || !keyInput.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {connecting ? 'Checking…' : 'Connect'}
            </button>
          </div>
          {formError && <div style={{ fontSize: 11, color: C.warn, marginTop: 6 }}>{formError}</div>}
          <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
            SimplePay → Profile → Manage Users → Add API User. We verify the key against the SimplePay API, then store it server-side against your workspace — your browser never sees it again.
          </div>
        </>
      )}
    </CardShell>
  )
}

// The five major SA banks. Statement upload is real today; a live feed is not built (needs an open-banking provider).
const BANKS = [
  { name: 'FNB', mono: 'FNB' },
  { name: 'Standard Bank', mono: 'SB' },
  { name: 'Nedbank', mono: 'NB' },
  { name: 'Absa', mono: 'AB' },
  { name: 'Capitec', mono: 'CP' },
]

function BanksPanel({ onUpload }) {
  return (
    <div className="glass" style={{ padding: 20, marginBottom: 14 }}>
      <h2 className="ttl">Your bank</h2>
      <div style={{ fontSize: 13, color: C.soft, marginTop: 4, lineHeight: 1.5 }}>
        Zeeder reads statements from all five major South African banks today. Live bank feeds are on the roadmap — until then, upload a statement and everything updates.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 14 }}>
        {BANKS.map((b) => (
          <div key={b.name} style={{ padding: 14, borderRadius: 14, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-logo)', fontSize: 11, color: C.gold, background: 'rgba(193,176,129,0.10)', border: '1px solid rgba(193,176,129,0.35)' }}>{b.mono}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{b.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.soft }}><span>Statement upload</span><span style={{ color: C.frank }}>Supported</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.soft }}><span>Live bank feed</span><span style={{ color: C.gold }}>Coming soon</span></div>
          </div>
        ))}
      </div>
      {onUpload && <button className="btn-gold" style={{ marginTop: 14 }} onClick={onUpload}>Upload a statement</button>}
    </div>
  )
}

export function Connections({
  onAsk, onNav, liveData, loading, error, isWonderland,
  payrollData, payrollLoading, payrollError, simplePayConnected, connectSimplePay, disconnectSimplePay,
}) {
  const claudeOk  = Boolean(SUPABASE_URL)
  const financeOk = !loading && !error && liveData != null
  const financeErr = !loading && !!error

  return (
    <div className="fade-up">
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.6 }}>
        These are the data sources Zeeder uses to give you real-time insights.
        Green means live data is flowing. If something is not connected, Zeeder falls back to your uploaded documents.
      </div>
      <BanksPanel onUpload={onNav ? () => onNav('documents') : undefined} />
      <div style={{ marginBottom: 12 }}><MailSettings /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <ConnCard icon="🤖" name="Zeeder AI (Claude)"
          desc="Powers all of Zeeder's analysis, document reading, and financial insights. Uses Anthropic's Claude model."
          status={claudeOk ? 'live' : 'error'}
          detail={claudeOk ? 'Routed through Supabase — Zeeder is thinking' : 'Supabase not configured — add VITE_SUPABASE_URL to .env'}
          onAsk={onAsk} askQ={claudeOk ? 'Give me a quick financial summary of the business right now' : null} />
        {isWonderland ? (
          <ConnCard icon="🏫" name="Wonderland Finance API"
            desc="Live feed of income, expenses, outstanding fees, and learner data direct from Wonderland's management system."
            status={loading ? 'soon' : financeOk ? 'live' : financeErr ? 'error' : 'off'}
            detail={loading ? 'Connecting...' :
              financeOk ? `${liveData?.children?.length ?? '—'} learners · ${liveData?.payments?.length ?? '—'} payment records loaded` :
              financeErr ? `Connection failed: ${error}` : null}
            onAsk={onAsk} askQ={financeOk ? 'What does the live Wonderland data tell us about cash flow this month?' : null} />
        ) : (
          <ConnCard icon="📤" name="Business Management System"
            desc="Most small businesses don't run a system Zeeder can connect to directly, and that's fine — upload your statements, invoices, and reports instead and Zeeder reads them just as accurately."
            status="off" detail="No live connection needed for your business — see Document Upload below"
            onAsk={onAsk} askQ="What documents should I upload to give Zeeder the best picture of my finances?" />
        )}
        <SimplePayCard payrollData={payrollData} payrollLoading={payrollLoading} payrollError={payrollError}
          simplePayConnected={simplePayConnected} connectSimplePay={connectSimplePay} disconnectSimplePay={disconnectSimplePay} onAsk={onAsk} />
        <ConnCard icon="📒" name="Accounting Software"
          desc="Connect Sage, Xero, or QuickBooks to pull trial balances, aged debtors, and creditor reports automatically."
          status="soon" detail="Coming soon — upload your age analysis reports manually until then"
          onAsk={onAsk} askQ="Which accounting software would work best for a business like mine?" />
        <ConnCard icon="📄" name="Document Upload"
          desc="Upload bank statements, invoices, debtor lists, and payroll reports as PDFs or CSVs. Zeeder reads and analyses them instantly."
          status="live" detail="Always available — the fallback when direct connections aren't set up yet"
          onAsk={onAsk} askQ="What documents should I upload to give Zeeder the best picture of my finances?" />
      </div>
    </div>
  )
}